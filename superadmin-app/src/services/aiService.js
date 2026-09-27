import {
  generateExecutiveSummary,
  detectAnomalies,
  generateSmartRecommendations,
  generateStaffInsight
} from '../utils/groqService';

/**
 * Superadmin AI Insights Service
 * Routes analysis requests through the serverless /api/insights endpoint
 */

/**
 * Fetch operational insights from /api/insights
 * @param {object} metrics - Metrics payload (tickets, department data, staff metrics)
 * @param {string} type - Analysis type (e.g., 'performance', 'workload', 'anomalies')
 * @returns {Promise<object>} - AI generated insights JSON
 */
export const fetchInsights = async (metrics, type = 'performance') => {
  const response = await fetch('/api/insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      metrics,
      type
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch insights (HTTP ${response.status})`);
  }

  return response.json();
};

export {
  generateExecutiveSummary,
  detectAnomalies,
  generateSmartRecommendations,
  generateStaffInsight
};

export default {
  fetchInsights,
  generateExecutiveSummary,
  detectAnomalies,
  generateSmartRecommendations,
  generateStaffInsight
};
