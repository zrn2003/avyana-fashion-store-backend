import { prisma } from './config/prisma';
import { generateDeliveryStickerMarkdown, generateTaxInvoiceMarkdown, renderReceiptSvg } from './modules/orders/orderReceipt.service';
import fs from 'fs';
import path from 'path';

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber: 'ORD-2610-5429' },
    include: {
      items: true,
      transactions: true,
    },
  });

  if (!order) {
    console.error('Order ORD-2610-5429 not found');
    return;
  }

  console.log('Rendering digital receipt QR code for order:', order.orderNumber);

  const storeSettings = await prisma.storeSetting.findFirst();
  const stickerMarkdown = generateDeliveryStickerMarkdown(order, storeSettings);
  const invoiceMarkdown = generateTaxInvoiceMarkdown(order, storeSettings);

  const stickerSvg = renderReceiptSvg(stickerMarkdown);
  const invoiceSvg = renderReceiptSvg(invoiceMarkdown);

  const outDir = path.resolve(__dirname, '../../out_receipts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'delivery_sticker.md'), stickerMarkdown, 'utf8');
  fs.writeFileSync(path.join(outDir, 'delivery_sticker.svg'), stickerSvg, 'utf8');
  fs.writeFileSync(path.join(outDir, 'tax_invoice.md'), invoiceMarkdown, 'utf8');
  fs.writeFileSync(path.join(outDir, 'tax_invoice.svg'), invoiceSvg, 'utf8');

  // Copy to artifacts directory
  const artifactDir = 'C:/Users/zisha/.gemini/antigravity-ide/brain/c56bff5c-121f-4028-a2ae-cfdf4be0ac02';
  try {
    fs.writeFileSync(path.join(artifactDir, 'delivery_sticker.svg'), stickerSvg, 'utf8');
    fs.writeFileSync(path.join(artifactDir, 'tax_invoice.svg'), invoiceSvg, 'utf8');
  } catch (err) {
    console.warn('Artifact copy notice:', err);
  }

  console.log('--- REGENERATED DELIVERY STICKER WITH DIGITAL RECEIPT QR ---');
  console.log(stickerMarkdown);
  console.log('--- REGENERATED TAX INVOICE WITH DIGITAL RECEIPT QR ---');
  console.log(invoiceMarkdown);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
