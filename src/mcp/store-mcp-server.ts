import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Initialize Store Manager MCP Server
const server = new McpServer({
  name: 'avyana-store-manager',
  version: '1.0.0',
});

// Tool 1: Export Orders to Styled Excel Sheet
server.tool(
  'export_orders_to_excel',
  {
    statusFilter: z
      .enum(['ALL', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
      .default('ALL')
      .describe('Filter orders by status, or ALL for all records'),
    outputPath: z
      .string()
      .default('./exports/orders_report.xlsx')
      .describe('File path where the Excel workbook should be saved'),
  },
  async ({ statusFilter, outputPath }) => {
    try {
      const whereClause: any = {};
      if (statusFilter !== 'ALL') {
        whereClause.orderStatus = statusFilter;
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        include: {
          items: true,
          user: true,
          address: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Avyana Craft - Handloom & Natural Dyes Store Manager';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Orders Master Report');

      // Define Columns
      worksheet.columns = [
        { header: 'Order #', key: 'orderNumber', width: 22 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Customer Name', key: 'customerName', width: 22 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'City', key: 'city', width: 16 },
        { header: 'State', key: 'state', width: 16 },
        { header: 'PIN Code', key: 'pincode', width: 12 },
        { header: 'Items Ordered', key: 'items', width: 36 },
        { header: 'Payment Method', key: 'paymentMethod', width: 18 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 },
        { header: 'Razorpay / UTR ID', key: 'utr', width: 26 },
        { header: 'Order Status', key: 'orderStatus', width: 16 },
        { header: 'Courier', key: 'courierName', width: 16 },
        { header: 'AWB Tracking', key: 'trackingAwb', width: 18 },
        { header: 'Total (INR)', key: 'totalAmount', width: 16 },
      ];

      // Format Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF800020' }, // Deep Burgundy Boutique theme
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 28;

      let totalGrossRevenue = 0;

      // Populate Rows
      orders.forEach((order, index) => {
        let city = '';
        let state = '';
        let pincode = '';
        let email = order.user?.email || '';

        // Check relational address if available
        if ((order as any).address) {
          city = (order as any).address.city || '';
          state = (order as any).address.state || '';
          pincode = (order as any).address.pincode || '';
        }

        // Safe address extraction from structured JSON or plain text
        if (order.shippingAddress) {
          try {
            const parsed =
              typeof order.shippingAddress === 'object' && order.shippingAddress !== null
                ? order.shippingAddress
                : JSON.parse(order.shippingAddress);

            if (parsed && typeof parsed === 'object') {
              city = parsed.city || parsed.district || city;
              state = parsed.state || state;
              pincode = parsed.pincode || parsed.postalCode || parsed.zip || pincode;
              if (!email && parsed.email) email = parsed.email;
            } else if (typeof parsed === 'string' && !city) {
              city = parsed;
            }
          } catch {
            if (!city && typeof order.shippingAddress === 'string') {
              city = order.shippingAddress;
            }
          }
        }

        const itemsSummary =
          order.items && order.items.length > 0
            ? order.items
                .map((i) => {
                  const title = i.productTitle || 'Product';
                  const variant = i.variantDetails ? ` (${i.variantDetails})` : '';
                  const qty = i.quantity || 1;
                  return `${title}${variant} x${qty}`;
                })
                .join('; ')
            : 'No Items Recorded';

        totalGrossRevenue += Number(order.totalAmount || 0);

        const row = worksheet.addRow({
          orderNumber: order.orderNumber,
          date: order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : '',
          customerName: order.shippingName || (order.user?.fullName) || 'Guest Customer',
          phone: order.shippingPhone || (order.user?.phone) || 'N/A',
          email,
          city,
          state,
          pincode,
          items: itemsSummary,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          utr: order.upiUtrNumber || 'N/A',
          orderStatus: order.orderStatus,
          courierName: order.courierName || 'Pending Dispatch',
          trackingAwb: order.trackingAwb || 'N/A',
          totalAmount: order.totalAmount,
        });

        // Alternating row background
        if (index % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDFBF7' },
          };
        }

        // Alignments & Number formatting
        row.getCell('orderNumber').alignment = { horizontal: 'center' };
        row.getCell('date').alignment = { horizontal: 'center' };
        row.getCell('phone').alignment = { horizontal: 'center' };
        row.getCell('pincode').alignment = { horizontal: 'center' };
        row.getCell('paymentStatus').alignment = { horizontal: 'center' };
        row.getCell('orderStatus').alignment = { horizontal: 'center' };
        row.getCell('totalAmount').numFmt = '₹#,##0.00';
        row.getCell('totalAmount').font = { bold: true };
      });

      // Total Summary Row
      const summaryRow = worksheet.addRow({
        orderNumber: 'TOTAL',
        customerName: `${orders.length} orders`,
        totalAmount: totalGrossRevenue,
      });
      summaryRow.font = { bold: true, size: 12 };
      summaryRow.getCell('totalAmount').numFmt = '₹#,##0.00';
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E8EE' },
      };

      // Resolve and save file
      const resolvedPath = path.resolve(outputPath);
      const parentDir = path.dirname(resolvedPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      await workbook.xlsx.writeFile(resolvedPath);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Excel report generated successfully!\n\n` +
              `• Destination: ${resolvedPath}\n` +
              `• Filter: ${statusFilter}\n` +
              `• Orders Exported: ${orders.length}\n` +
              `• Total Revenue: ₹${totalGrossRevenue.toLocaleString('en-IN')}\n\n` +
              `You can open this file directly in Microsoft Excel, Google Sheets, or Apple Numbers.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Export failed: ${error?.message || error}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: Fetch Orders from Neon Database
server.tool(
  'fetch_orders',
  {
    limit: z.number().int().min(1).max(100).default(20).describe('Max orders to retrieve (1-100)'),
    statusFilter: z
      .enum(['ALL', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
      .default('ALL')
      .describe('Filter orders by status'),
    search: z.string().optional().describe('Search query for orderNumber, customer name, or phone number'),
  },
  async ({ limit, statusFilter, search }) => {
    try {
      const where: any = {};
      if (statusFilter !== 'ALL') {
        where.orderStatus = statusFilter;
      }
      if (search && search.trim()) {
        const query = search.trim();
        where.OR = [
          { orderNumber: { contains: query } },
          { shippingName: { contains: query } },
          { shippingPhone: { contains: query } },
        ];
      }

      const orders = await prisma.order.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });

      if (orders.length === 0) {
        return {
          content: [{ type: 'text', text: 'No orders found matching the specified criteria.' }],
        };
      }

      const summaryList = orders.map((o) => ({
        orderNumber: o.orderNumber,
        customer: `${o.shippingName} (${o.shippingPhone})`,
        amount: `₹${o.totalAmount.toLocaleString('en-IN')}`,
        status: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        utrOrPaymentId: o.upiUtrNumber || 'N/A',
        courier: o.courierName || 'Unassigned',
        trackingAwb: o.trackingAwb || 'N/A',
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        placedAt: o.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      }));

      return {
        content: [
          {
            type: 'text',
            text: `📦 Found ${orders.length} order(s):\n\n` +
              summaryList
                .map(
                  (o) =>
                    `• **${o.orderNumber}** | ${o.customer} | **${o.amount}**\n` +
                    `  Status: [${o.status}] • Payment: [${o.paymentStatus}] via ${o.paymentMethod}\n` +
                    `  Ref/UTR: \`${o.utrOrPaymentId}\` • Courier: ${o.courier} (AWB: ${o.trackingAwb})\n` +
                    `  Items: ${o.itemCount} unit(s) • Date: ${o.placedAt}`
                )
                .join('\n\n'),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Fetch failed: ${error?.message || error}` }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get Detailed Order Inspection
server.tool(
  'get_order_details',
  {
    orderIdentifier: z.string().describe('Order Number (e.g. ORD-20261004-9842) or Order CUID'),
  },
  async ({ orderIdentifier }) => {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ orderNumber: orderIdentifier }, { id: orderIdentifier }],
        },
        include: {
          items: true,
          user: true,
          address: true,
        },
      });

      if (!order) {
        return {
          content: [{ type: 'text', text: `Order "${orderIdentifier}" was not found in the database.` }],
        };
      }

      let parsedAddress: any = null;
      try {
        parsedAddress = JSON.parse(order.shippingAddress);
      } catch {
        parsedAddress = order.shippingAddress;
      }

      let razorpayDetails: any = null;
      if (order.adminNotes) {
        try {
          razorpayDetails = JSON.parse(order.adminNotes);
        } catch {
          razorpayDetails = order.adminNotes;
        }
      }

      const details = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customer: {
          name: order.shippingName,
          phone: order.shippingPhone,
          email: order.user?.email || parsedAddress?.email || 'N/A',
          deliveryAddress: parsedAddress,
        },
        pricing: {
          subtotal: order.subtotal,
          shippingFee: order.shippingFee,
          discountTotal: order.discountTotal,
          totalAmount: order.totalAmount,
        },
        payment: {
          method: order.paymentMethod,
          status: order.paymentStatus,
          utrOrRazorpayId: order.upiUtrNumber,
          gatewayAcknowledgment: razorpayDetails,
        },
        fulfillment: {
          status: order.orderStatus,
          courierName: order.courierName,
          trackingAwb: order.trackingAwb,
          trackingUrl: order.trackingUrl,
          dispatchedAt: order.dispatchedAt,
          deliveredAt: order.deliveredAt,
        },
        items: order.items.map((i) => ({
          title: i.productTitle,
          variant: i.variantDetails,
          sku: i.sku,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
        createdAt: order.createdAt,
      };

      return {
        content: [
          {
            type: 'text',
            text: `📄 **Order Details for ${order.orderNumber}**\n\n` +
              `\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Order details query failed: ${error?.message || error}` }],
        isError: true,
      };
    }
  }
);

// Tool 4: Update Order Fulfillment & Tracking Status
server.tool(
  'update_order_status',
  {
    orderIdentifier: z.string().describe('Order Number (e.g. ORD-20261004-9842) or Order ID'),
    newStatus: z
      .enum(['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
      .describe('New fulfillment status'),
    courierName: z.string().optional().describe('Courier partner (e.g. Blue Dart, Delhivery, DTDC)'),
    trackingAwb: z.string().optional().describe('AWB Consignment Tracking Number'),
    trackingUrl: z.string().optional().describe('Online tracking URL'),
    adminNotes: z.string().optional().describe('Internal admin notes'),
  },
  async ({ orderIdentifier, newStatus, courierName, trackingAwb, trackingUrl, adminNotes }) => {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ orderNumber: orderIdentifier }, { id: orderIdentifier }],
        },
      });

      if (!order) {
        return {
          content: [{ type: 'text', text: `Order "${orderIdentifier}" not found.` }],
        };
      }

      if (order.orderStatus === 'DELIVERED' && newStatus === 'CANCELLED') {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ Cannot directly cancel order #${order.orderNumber} because it has already been DELIVERED. Delivered orders must proceed through the verified returns process.`,
            },
          ],
        };
      }

      const updateData: any = {
        orderStatus: newStatus,
        updatedAt: new Date(),
      };

      if (courierName) updateData.courierName = courierName;
      if (trackingAwb) updateData.trackingAwb = trackingAwb;
      if (trackingUrl) updateData.trackingUrl = trackingUrl;
      if (adminNotes) updateData.adminNotes = adminNotes;

      if (newStatus === 'SHIPPED' && !order.dispatchedAt) {
        updateData.dispatchedAt = new Date();
      }
      if (newStatus === 'DELIVERED' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }

      const updated = await prisma.$transaction(async (tx) => {
        // ACID Inventory Consistency: Restore inventory if order is being cancelled
        if (newStatus === 'CANCELLED' && order.orderStatus !== 'CANCELLED') {
          const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
          for (const item of items) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockCount: { increment: item.quantity } },
            });
          }
        }

        return tx.order.update({
          where: { id: order.id },
          data: updateData,
        });
      });

      // Generate instant WhatsApp tracking message for store manager to send
      const cleanPhone = updated.shippingPhone.replace(/\D/g, '');
      const encodedMsg = encodeURIComponent(
        `Hello ${updated.shippingName}! Your Avyana Craft order #${updated.orderNumber} status has been updated to "${updated.orderStatus}". ` +
          (updated.trackingAwb ? `Courier: ${updated.courierName || 'Courier'} | AWB: ${updated.trackingAwb}. ` : '') +
          `Track live here: https://avyanacraft.com`
      );
      const whatsappLink = `https://wa.me/91${cleanPhone}?text=${encodedMsg}`;

      return {
        content: [
          {
            type: 'text',
            text: `✅ Order **${updated.orderNumber}** status updated to **${updated.orderStatus}**!\n\n` +
              (updated.courierName ? `• Courier: ${updated.courierName}\n` : '') +
              (updated.trackingAwb ? `• AWB: ${updated.trackingAwb}\n` : '') +
              (updated.dispatchedAt ? `• Dispatched At: ${updated.dispatchedAt.toISOString()}\n` : '') +
              (updated.deliveredAt ? `• Delivered At: ${updated.deliveredAt.toISOString()}\n` : '') +
              `\n📲 **WhatsApp Customer Notification Link:**\n[Click to Notify Customer on WhatsApp](${whatsappLink})`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ Status update failed: ${error?.message || error}` }],
        isError: true,
      };
    }
  }
);

// Tool 5: Live Store & Sales Analytics
server.tool('get_store_analytics', {}, async () => {
  try {
    const orders = await prisma.order.findMany({
      select: {
        totalAmount: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const verifiedRevenue = orders
      .filter((o) => o.paymentStatus === 'VERIFIED')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const statusCounts: Record<string, number> = {};
    orders.forEach((o) => {
      statusCounts[o.orderStatus] = (statusCounts[o.orderStatus] || 0) + 1;
    });

    // Low stock variants (< 5 units)
    const lowStockVariants = await prisma.productVariant.findMany({
      where: { stockCount: { lte: 5 } },
      include: { product: true },
      take: 10,
    });

    const report = {
      totalOrders: orders.length,
      grossRevenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
      verifiedPaymentRevenue: `₹${verifiedRevenue.toLocaleString('en-IN')}`,
      ordersByStatus: statusCounts,
      pendingFulfillments: (statusCounts['PLACED'] || 0) + (statusCounts['CONFIRMED'] || 0) + (statusCounts['PACKED'] || 0),
      lowStockAlertsCount: lowStockVariants.length,
      sampleLowStockItems: lowStockVariants.map((v) => ({
        product: v.product.title,
        variant: `${v.colorName} / ${v.size}`,
        stockRemaining: v.stockCount,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: `📊 **Avyana Craft - Live Store Analytics**\n\n` +
            `\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `❌ Analytics failed: ${error?.message || error}` }],
      isError: true,
    };
  }
});

// Run server over stdio for AI clients (Claude Desktop, Cursor, Antigravity)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Avyana Craft Store MCP Server running via stdio');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
