const { db } = require('../config/database');

class Institucion {
    static async findById(id) {
        return await db.get("SELECT * FROM Instituciones WHERE id = $1", [id]);
    }

    /**
     * Determina si una cuenta tiene plan vitalicio explícito.
     */
    static esCuentaPreviaVitalicia(inst) {
        if (!inst) return false;
        const currentPlan = (inst.plan || '').toLowerCase();
        return (currentPlan === 'vitalicio' || currentPlan === 'pago_unico' || currentPlan === 'pro_vitalicio' || inst.tipo_licencia === 'vitalicio');
    }

    static async checkSubscriptionStatus(id) {
        const inst = await this.findById(id);
        if (!inst) return null;

        const { plan, estado, fecha_ultimo_pago, fecha_creacion } = inst;
        const currentPlan = plan ? plan.toLowerCase() : 'prueba_30d';
        const esVitalicia = this.esCuentaPreviaVitalicia(inst);
        const tipoLic = esVitalicia ? 'vitalicio' : 'anual';

        // Si ya está suspendido explícitamente, respetamos ese estado
        if (estado === 'suspendido') {
            const isTrial = (currentPlan.includes('prueba') || currentPlan === 'docente' || currentPlan === 'basico_7d');
            const isAnual = (currentPlan === 'anual');
            return { 
                status: 'suspendido', 
                daysLeft: 0, 
                plan: currentPlan, 
                warning: false,
                isTrial: isTrial,
                expiredTrial: isTrial,
                expiredAnnual: isAnual,
                tipoLicencia: tipoLic
            };
        }

        // Si está pendiente de pago
        if (estado === 'pendiente_pago') {
            return { status: 'pendiente_pago', daysLeft: 0, plan: currentPlan, warning: false, tipoLicencia: tipoLic };
        }

        // Plan Vitalicio (Pago Único: Nunca expira)
        if (currentPlan === 'vitalicio' || currentPlan === 'pago_unico' || currentPlan === 'pro_vitalicio') {
            return { status: estado, daysLeft: 999999, plan: 'vitalicio', warning: false, isTrial: false, tipoLicencia: 'vitalicio' };
        }

        const now = new Date();
        const refDate = new Date(fecha_ultimo_pago || fecha_creacion || now);
        const diffMs = now - refDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // Plan Anual (365 días - Nuevas cuentas creadas a partir del 13 de Octubre 2026)
        if (currentPlan === 'anual') {
            const limit = 365;
            const warnDays = 350; // Advertencia 15 días antes
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { 
                    status: 'suspendido', 
                    daysLeft: 0, 
                    plan: 'anual', 
                    warning: false, 
                    expiredAnnual: true, 
                    isTrial: false,
                    tipoLicencia: 'anual' 
                };
            } else {
                const daysLeft = Math.max(1, Math.ceil(limit - diffDays));
                return { 
                    status: estado, 
                    daysLeft: daysLeft, 
                    plan: 'anual', 
                    warning: diffDays >= warnDays, 
                    isTrial: false, 
                    expiredAnnual: false,
                    tipoLicencia: 'anual' 
                };
            }
        }

        // Plan Prueba Gratuita (30 días)
        if (currentPlan === 'prueba_30d' || currentPlan === 'prueba_7d' || currentPlan === 'prueba' || currentPlan === 'docente' || currentPlan === 'basico_7d') {
            const limit = 30;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { 
                    status: 'suspendido', 
                    daysLeft: 0, 
                    plan: currentPlan, 
                    warning: false, 
                    expiredTrial: true, 
                    isTrial: true,
                    tipoLicencia: tipoLic
                };
            } else {
                const daysLeft = Math.max(1, Math.ceil(limit - diffDays));
                return { 
                    status: estado, 
                    daysLeft: daysLeft, 
                    plan: currentPlan, 
                    warning: daysLeft <= 3, 
                    isTrial: true, 
                    expiredTrial: false,
                    tipoLicencia: tipoLic
                };
            }
        }

        if (currentPlan === 'basico') {
            const limit = 30;
            const warnDays = 27;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { status: 'suspendido', daysLeft: 0, plan: currentPlan, warning: false, tipoLicencia: tipoLic };
            } else if (diffDays >= warnDays) {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: true, tipoLicencia: tipoLic };
            } else {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: false, tipoLicencia: tipoLic };
            }
        } else if (currentPlan === 'medio') {
            const limit = 180;
            const warnDays = 177;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { status: 'suspendido', daysLeft: 0, plan: currentPlan, warning: false, tipoLicencia: tipoLic };
            } else if (diffDays >= warnDays) {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: true, tipoLicencia: tipoLic };
            } else {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: false, tipoLicencia: tipoLic };
            }
        } else if (currentPlan === 'pro') {
            const limit = 365;
            const warnDays = 362;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { status: 'suspendido', daysLeft: 0, plan: currentPlan, warning: false, tipoLicencia: tipoLic };
            } else if (diffDays >= warnDays) {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: true, tipoLicencia: tipoLic };
            } else {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: false, tipoLicencia: tipoLic };
            }
        } else {
            return { status: estado, daysLeft: 999999, plan: currentPlan, warning: false, tipoLicencia: tipoLic };
        }
    }

    /**
     * Activa el plan para una institución.
     * Por defecto activa 'anual' ($99 MXN por 365 días).
     * Si forzarPlan está definido ('vitalicio', 'anual', etc.), se respeta la decisión del SuperAdmin.
     */
    static async activarPlan(institucionId, { monto = 99, referencia = '', metodo = 'mercadopago', forzarPlan = null } = {}) {
        const inst = await this.findById(institucionId);
        if (!inst) throw new Error('Institución no encontrada.');

        let planDestino = forzarPlan || 'anual';

        const isSQLite = !process.env.DATABASE_URL;
        const nowQuery = isSQLite ? "datetime('now', 'localtime')" : "CURRENT_TIMESTAMP";

        await db.run(`
            UPDATE Instituciones 
            SET estado = 'activo', 
                plan = $1, 
                monto_pagado = $2, 
                referencia_pago = $3, 
                metodo_pago = $4, 
                fecha_ultimo_pago = ${nowQuery}, 
                fecha_pago = ${nowQuery}
            WHERE id = $5
        `, [planDestino, monto, referencia, metodo, institucionId]);

        return { plan: planDestino };
    }

    static async activarPlanVitalicio(institucionId, options = {}) {
        return await this.activarPlan(institucionId, options);
    }

    static async verificarAbusoPrueba(deviceFingerprint, ip) {
        if (!deviceFingerprint && !ip) return { abuso: false };

        // 1. Verificar por Huella de Dispositivo (LocalStorage/Cookie persistente)
        if (deviceFingerprint) {
            const inst = await db.get(`
                SELECT id, nombre, estado, plan, monto_pagado, fecha_creacion, tipo_licencia 
                FROM Instituciones 
                WHERE device_fingerprint = $1 
                  AND plan NOT IN ('vitalicio', 'pago_unico', 'pro_vitalicio', 'anual') 
                  AND (monto_pagado IS NULL OR monto_pagado = 0)
                ORDER BY id DESC LIMIT 1
            `, [deviceFingerprint]);

            if (inst) {
                const st = await this.checkSubscriptionStatus(inst.id);
                if (st && (st.status === 'suspendido' || st.daysLeft <= 0)) {
                    return { 
                        abuso: true, 
                        institucion_id: inst.id, 
                        razon: 'dispositivo',
                        mensaje: 'Ya se utilizó un periodo de prueba gratuita de 30 días en este dispositivo. Para continuar, activa tu Suscripción Anual por $99 MXN al año.'
                    };
                }
            }
        }

        // 2. Verificar por IP (máximo 2 pruebas no pagadas por IP para evitar abusos por red)
        if (ip && ip !== '127.0.0.1' && ip !== '::1') {
            const count = await db.get(`
                SELECT COUNT(*) as total 
                FROM Instituciones 
                WHERE ip_registro = $1 
                  AND plan NOT IN ('vitalicio', 'pago_unico', 'pro_vitalicio', 'anual') 
                  AND estado = 'suspendido'
                  AND (monto_pagado IS NULL OR monto_pagado = 0)
            `, [ip]);

            if (count && count.total >= 2) {
                return { 
                    abuso: true, 
                    razon: 'ip',
                    mensaje: 'Límite de pruebas gratuitas alcanzado en esta red. Adquiere tu suscripción por $99 MXN al año.'
                };
            }
        }

        return { abuso: false };
    }
}

module.exports = Institucion;
