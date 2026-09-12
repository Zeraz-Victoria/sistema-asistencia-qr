const DashboardService = require('../services/dashboardService');

class DashboardController {
    static async getStats(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const stats = await DashboardService.getStats(institucion_id);
            res.status(200).json(stats);
        } catch (error) {
            console.error("Error Dashboard:", error);
            res.status(500).json({ error: 'Error al obtener estadísticas.' });
        }
    }
}

module.exports = DashboardController;
