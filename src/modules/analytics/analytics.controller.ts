import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/response';

export class AnalyticsController {
  static async getStoreAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const timeframe = (req.query.timeframe as string) || '30d';
      const analytics = await AnalyticsService.getStoreAnalytics(timeframe);
      return sendSuccess(res, analytics, 'Store analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async recordEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventType, sessionId, visitorId, productId, trafficSource, deviceType, path, metadata } = req.body;
      const event = await AnalyticsService.recordEvent({
        eventType,
        sessionId,
        visitorId,
        productId,
        trafficSource,
        deviceType,
        path,
        metadata,
      });
      return sendSuccess(res, { event }, 'Event recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const timeframe = (req.query.timeframe as string) || '30d';
      const data = await AnalyticsService.getStoreAnalytics(timeframe);

      // Generate clean CSV content
      const lines: string[] = [];
      lines.push('--- AVYANA CRAFT STORE PERFORMANCE & ANALYTICS REPORT ---');
      lines.push(`Generated At,${new Date().toISOString()}`);
      lines.push(`Timeframe,${timeframe}`);
      lines.push('');
      lines.push('--- CORE BUSINESS METRICS ---');
      lines.push('Metric,Value,Growth');
      lines.push(`Sessions,${data.kpis.sessions.value},+${data.kpis.sessions.growth}%`);
      lines.push(`Unique Visitors,${data.kpis.uniqueVisitors.value},+${data.kpis.uniqueVisitors.growth}%`);
      lines.push(`Bounce Rate,${data.kpis.bounceRate.formatted},${data.kpis.bounceRate.trend}%`);
      lines.push(`Avg Session Duration,${data.kpis.avgSessionDuration.value},+${data.kpis.avgSessionDuration.growth}%`);
      lines.push(`Total Verified Orders,${data.kpis.totalOrders.value},+${data.kpis.totalOrders.growth}%`);
      lines.push(`Gross Revenue,${data.kpis.grossRevenue.formatted},AOV: ${data.kpis.grossRevenue.avgOrderValue}`);
      lines.push('');
      lines.push('--- TRAFFIC CHANNELS ---');
      lines.push('Channel,Share (%)');
      data.trafficChannels.forEach((tc) => {
        lines.push(`"${tc.name}",${tc.percent}%`);
      });
      lines.push('');
      lines.push('--- CONVERSION FUNNEL ---');
      lines.push('Step,Count,Conversion %,Drop-off');
      data.conversionFunnel.forEach((cf) => {
        lines.push(`"${cf.step}",${cf.count},${cf.percent}%,${cf.dropoff}`);
      });
      lines.push('');
      lines.push('--- TRENDING & MOST VISITED PRODUCTS ---');
      lines.push('Product Title,Category,Base Price,Sale Price,Views,Orders,Conversion Rate %,Status,Badge');
      data.trendingProducts.forEach((tp) => {
        lines.push(
          `"${tp.title.replace(/"/g, '""')}","${tp.category}",${tp.basePrice},${tp.salePrice},${tp.viewCount},${tp.ordersCount},${tp.conversionRate}%,${tp.isSoldOut ? 'Sold Out' : 'In Stock'},"${tp.badge}"`
        );
      });

      const csvContent = lines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="atelier-analytics-report-${timeframe}.csv"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}
