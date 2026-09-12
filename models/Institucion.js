const { db } = require('../config/database');

class Institucion {
    static async findById(id) {
        return await db.get("SELECT * FROM Instituciones WHERE id = $1", [id]);
    }

    static async checkSubscriptionStatus(id) {
        const inst = await this.findById(id);
        if (!inst) return null;

        const { plan, estado, fecha_ultimo_pago, fecha_creacion } = inst;

        // Si ya está suspendido explícitamente, respetamos ese estado
        if (estado === 'suspendido') {
            return { status: 'suspendido', daysLeft: 0, plan: plan || 'basico', warning: false };
        }

        // Si está pendiente de pago
        if (estado === 'pendiente_pago') {
            return { status: 'pendiente_pago', daysLeft: 0, plan: plan || 'vitalicio', warning: false };
        }

        const currentPlan = plan ? plan.toLowerCase() : 'prueba_7d';

        // Plan Vitalicio (Pago Único: Nunca expira)
        if (currentPlan === 'vitalicio' || currentPlan === 'pago_unico' || currentPlan === 'pro_vitalicio') {
            return { status: estado, daysLeft: 999999, plan: 'vitalicio', warning: false, isTrial: false };
        }

        const now = new Date();
        const refDate = new Date(fecha_creacion || fecha_ultimo_pago || now);
        const diffMs = now - refDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // Plan Prueba Gratuita (7 días)
        if (currentPlan === 'prueba_7d' || currentPlan === 'prueba' || currentPlan === 'docente' || currentPlan === 'basico_7d') {
            const limit = 7;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { 
                    status: 'suspendido', 
                    daysLeft: 0, 
                    plan: 'prueba_7d', 
                    warning: false, 
                    expiredTrial: true, 
                    isTrial: true 
                };
            } else {
                const daysLeft = Math.max(1, Math.ceil(limit - diffDays));
                return { 
                    status: estado, 
                    daysLeft: daysLeft, 
                    plan: 'prueba_7d', 
                    warning: daysLeft <= 2, 
                    isTrial: true, 
                    expiredTrial: false 
                };
            }
        }

        if (currentPlan === 'basico') {
            const limit = 30;
            const warnDays = 27;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { status: 'suspendido', daysLeft: 0, plan: currentPlan, warning: false };
            } else if (diffDays >= warnDays) {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: true };
            } else {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: false };
            }
        } else if (currentPlan === 'medio') {
            const limit = 180;
            const warnDays = 177;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { status: 'suspendido', daysLeft: 0, plan: currentPlan, warning: false };
            } else if (diffDays >= warnDays) {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: true };
            } else {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: false };
            }
        } else if (currentPlan === 'pro') {
            const limit = 365;
            const warnDays = 362;
            if (diffDays >= limit) {
                await db.run("UPDATE Instituciones SET estado = 'suspendido' WHERE id = $1", [id]);
                return { status: 'suspendido', daysLeft: 0, plan: currentPlan, warning: false };
            } else if (diffDays >= warnDays) {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: true };
            } else {
                return { status: estado, daysLeft: Math.max(0, Math.ceil(limit - diffDays)), plan: currentPlan, warning: false };
            }
        } else {
            // Plan por defecto o ilimitados (por si acaso)
            return { status: estado, daysLeft: 999999, plan: currentPlan, warning: false };
        }
    }

    static async activarPlanVitalicio(institucionId, { monto = 99, referencia = '', metodo = 'mercadopago' } = {}) {
        await db.run(`
            UPDATE Instituciones 
            SET estado = 'activo', 
                plan = 'vitalicio', 
                monto_pagado = $1, 
                referencia_pago = $2, 
                metodo_pago = $3, 
                fecha_ultimo_pago = CURRENT_TIMESTAMP, 
                fecha_pago = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [monto, referencia, metodo, institucionId]);
    }

    static async verificarAbusoPrueba(deviceFingerprint, ip) {
        if (!deviceFingerprint && !ip) return { abuso: false };

        // 1. Verificar por Huella de Dispositivo (LocalStorage/Cookie persistente)
        if (deviceFingerprint) {
            const inst = await db.get(`
                SELECT id, nombre, estado, plan, monto_pagado 
                FROM Instituciones 
                WHERE device_fingerprint = $1 
                  AND plan != 'vitalicio' 
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
                        mensaje: 'Ya se utilizó un periodo de prueba gratuita de 7 días en este dispositivo. Para continuar, activa tu Licencia Vitalicia por $99 MXN.'
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
                  AND plan != 'vitalicio' 
                  AND estado = 'suspendido'
                  AND (monto_pagado IS NULL OR monto_pagado = 0)
            `, [ip]);

            if (count && count.total >= 2) {
                return { 
                    abuso: true, 
                    razon: 'ip',
                    mensaje: 'Límite de pruebas gratuitas alcanzado en esta red. Adquiere tu Licencia Vitalicia por $99 MXN.'
                };
            }
        }

        return { abuso: false };
    }
}

module.exports = Institucion;
