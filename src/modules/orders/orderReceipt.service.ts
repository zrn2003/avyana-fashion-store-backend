import receiptline from 'receiptline';

export function formatOrderAddress(shippingAddress: any, order?: any): string {
  // 1. Check normalized order fields first
  const src = order || (typeof shippingAddress === 'object' && shippingAddress !== null ? shippingAddress : null);
  if (src && (src.shippingStreet || src.streetLine1 || src.street)) {
    const street = src.shippingStreet || src.streetLine1 || src.street;
    const city = src.shippingCity || src.city;
    const state = src.shippingState || src.state;
    const pincode = src.shippingPincode || src.pincode;
    const parts = [
      street,
      src.streetLine2,
      city,
      state,
      pincode ? `PIN: ${pincode}` : '',
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }

  if (!shippingAddress) return 'Address on file';

  if (typeof shippingAddress === 'object') {
    const parts = [
      shippingAddress.streetLine1 || shippingAddress.street || shippingAddress.shippingStreet,
      shippingAddress.streetLine2,
      shippingAddress.city || shippingAddress.shippingCity,
      shippingAddress.state || shippingAddress.shippingState,
      shippingAddress.pincode ? `PIN: ${shippingAddress.pincode}` : '',
    ].filter(Boolean);
    return parts.join(', ');
  }

  if (typeof shippingAddress === 'string') {
    try {
      const parsed = JSON.parse(shippingAddress);
      if (typeof parsed === 'object' && parsed !== null) {
        return formatOrderAddress(parsed);
      }
    } catch {
      // not JSON
    }
    return shippingAddress.trim() || 'Address on file';
  }

  return 'Address on file';
}

export function formatCustomerPhone(phone: string): string {
  if (!phone) return '0000000000';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits || phone;
}

export function resolveOrderPaymentInfo(order: any) {
  const isPaid = order.paymentStatus === 'VERIFIED';
  const isCod = order.paymentMethod === 'COD';
  const isUpi = order.paymentMethod === 'DIRECT_UPI';

  let paymentMode = 'Prepaid Online';
  if (isUpi) {
    paymentMode = 'Direct UPI (GPay / PhonePe / Paytm)';
  } else if (isCod) {
    paymentMode = 'Cash On Delivery (COD)';
  } else if (order.paymentMethod === 'RAZORPAY') {
    paymentMode = 'Razorpay (Card / NetBanking / UPI)';
  } else if (order.paymentMethod) {
    paymentMode = String(order.paymentMethod);
  }

  const paymentId =
    order.paymentId ||
    order.gatewayPaymentId ||
    order.razorpayPaymentId ||
    (order.transactions && order.transactions[0]?.gatewayPaymentId) ||
    (isUpi
      ? `UPI-TXN-${order.orderNumber}`
      : isCod
      ? `COD-${order.orderNumber}`
      : `TXN-${order.orderNumber}`);

  const paymentUtr = order.upiUtrNumber
    ? order.upiUtrNumber
    : isUpi
    ? 'Pending UTR Submission'
    : isCod
    ? 'N/A (Cash on Delivery)'
    : (order.gatewayPaymentId || order.razorpayPaymentId || 'Settled via Gateway');

  const settlementStatus = isPaid
    ? 'PAID & VERIFIED (SETTLED)'
    : isCod
    ? 'DUE UPON DELIVERY'
    : 'PAYMENT PENDING VERIFICATION';

  return {
    isPaid,
    isCod,
    isUpi,
    paymentMode,
    paymentId,
    paymentUtr,
    settlementStatus,
  };
}

export function generateDeliveryStickerMarkdown(order: any, storeSettings?: any): string {
  const storeName = storeSettings?.storeName || 'Avyana Craft';
  const warehouseAddress =
    storeSettings?.warehouseAddress || 'Heritage Weaves Studio, Pune, MH - 411005';
  const orderId = order.orderNumber || order.id || 'ORD-0000';
  const customerName = order.shippingName || 'Valued Patron';
  const shippingAddress = formatOrderAddress(order.shippingAddress);
  const customerPhone = formatCustomerPhone(order.shippingPhone);

  const { isPaid, isCod, paymentMode, paymentId, paymentUtr } = resolveOrderPaymentInfo(order);

  let paymentStatusHeader = 'PAYMENT PENDING';
  let paymentActionTag = 'VERIFY PAYMENT BEFORE DISPATCH';
  let cashCollectionLine = `Total Due: Rs. ${order.totalAmount.toLocaleString('en-IN')}`;

  if (isPaid) {
    paymentStatusHeader = 'PAID ONLINE / PREPAID';
    paymentActionTag = 'DO NOT COLLECT CASH';
    cashCollectionLine = `[C] Total Paid: Rs. ${order.totalAmount.toLocaleString('en-IN')} (Verified Online)`;
  } else if (isCod) {
    paymentStatusHeader = 'CASH ON DELIVERY (COD)';
    paymentActionTag = `COLLECT Rs. ${order.totalAmount.toLocaleString('en-IN')}`;
    cashCollectionLine = `[C] **COLLECT CASH: Rs. ${order.totalAmount.toLocaleString('en-IN')}**`;
  }

  const websiteUrl = storeSettings?.websiteUrl || process.env.CORS_ORIGIN || 'https://avyanacraft.com';
  const digitalReceiptUrl = `${websiteUrl}/?receipt=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(customerPhone)}`;

  return `^^ ${storeName}
| Handcrafted Indian Weaves & Heritage Textiles |
| Individual Small-Scale Business • Micro Enterprise |
| GSTIN / CIN: Not Applicable (Artisan Exempt) |
------------------------------------------------
{code:${orderId}; option:code128,50}
[C] **DISPATCH LABEL • ORDER ID: ${orderId}**
------------------------------------------------
[L] **SHIPPED BY:**
[L] ${storeName} (Individual Micro Enterprise)
[L] ${warehouseAddress}
[L] GSTIN / CIN: Not Applicable (Turnover below threshold)

[L] **DELIVER TO:**
[L] **${customerName}**
[L] ${shippingAddress}
[L] Phone: +91 ${customerPhone}
------------------------------------------------
           === ${paymentStatusHeader} ===
           
               [[ ${paymentActionTag} ]]
               
           ============================
[C] Payment Mode: ${paymentMode}
[C] Payment ID: ${paymentId}
[C] Payment UTR: ${paymentUtr}
${cashCollectionLine}
------------------------------------------------
{code:${digitalReceiptUrl}; option:qrcode}
[C] Scan for Official Digital Receipt & Order Copy
[C] Direct Order Verification: ${orderId}
[C] Verified Authentic Artisan Delivery Label
------------------------------------------------`;
}

export function generateTaxInvoiceMarkdown(order: any, storeSettings?: any): string {
  const storeName = storeSettings?.storeName || 'Avyana Craft';
  const orderId = order.orderNumber || order.id || 'ORD-0000';
  const customerName = order.shippingName || 'Valued Patron';
  const shippingAddress = formatOrderAddress(order.shippingAddress);
  const customerPhone = formatCustomerPhone(order.shippingPhone);

  const websiteUrl = storeSettings?.websiteUrl || process.env.CORS_ORIGIN || 'https://avyana-fashion-store-backend.onrender.com';
  const digitalReceiptUrl = `${websiteUrl}/?receipt=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(customerPhone)}`;

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subtotal = order.subtotalAmount || order.totalAmount;
  const shipping = order.shippingAmount || 0;
  const discount = order.discountAmount || 0;
  const total = order.totalAmount;

  const { paymentMode, paymentId, paymentUtr, settlementStatus } =
    resolveOrderPaymentInfo(order);

  const itemsRows = (order.items || []).map((item: any) => {
    const title = (item.productTitle || 'Artisanal Piece').slice(0, 26);
    const variant = item.variantDetails ? ` (${item.variantDetails.slice(0, 15)})` : '';
    const linePrice = `Rs. ${(item.unitPrice * item.quantity).toLocaleString('en-IN')}`;
    return `| ${title}${variant} | ${item.quantity} | ${linePrice} |`;
  });

  return `^^ ${storeName}
| Handloom Heritage & Luxury Artisanal Studio |
| Entity: Individual Small-Scale Business (Micro Enterprise) |
| GSTIN: Not Applicable (Turnover Below GST Threshold) |
| CIN: Not Applicable (Sole Proprietorship / Individual Enterprise) |
------------------------------------------------
| RETAIL SALE INVOICE & BILL OF SUPPLY |
| Official Cash Memo & Delivery Receipt |
| Invoice Ref: INV-${orderId} |
| Order Ref: ${orderId} | Date: ${orderDate} |
------------------------------------------------
| BILLED & SHIPPED TO: |
| "${customerName}" |
| ${shippingAddress} |
| Phone: +91 ${customerPhone} |
------------------------------------------------
{border:space; width:*,4,12}
| ITEM DESCRIPTION | QTY | TOTAL |
------------------------------------------------
${itemsRows.length > 0 ? itemsRows.join('\n') : '| Artisanal Apparel Item | 1 | Rs. ' + total.toLocaleString('en-IN') + ' |'}
------------------------------------------------
{border:none; width:*,14}
Subtotal | Rs. ${subtotal.toLocaleString('en-IN')}
Shipping Fee | ${shipping === 0 ? 'FREE Handloom Delivery' : 'Rs. ' + shipping.toLocaleString('en-IN')}
${discount > 0 ? `Boutique Privilege Discount | -Rs. ${discount.toLocaleString('en-IN')}\n` : ''}Taxes (GST) | Rs. 0.00 (Small Business Exempt)
------------------------------------------------
{border:line; width:*,16}
^^ NET PAYABLE | ^^Rs. ${total.toLocaleString('en-IN')}
{border:none}
------------------------------------------------
| === PAYMENT & SETTLEMENT DETAILS === |
------------------------------------------------
{border:space; width:15,*}
Payment Mode | ${paymentMode}
Payment ID | ${paymentId}
Payment UTR | ${paymentUtr}
Settlement | "${settlementStatus}"
Gross Amount | Rs. ${total.toLocaleString('en-IN')}
------------------------------------------------
| DECLARATION: Small-Scale Individual Enterprise. |
| Composition / GST Exempt. No tax charged or collected. |
| Pure Botanical Dyes & Authentic Handcrafted Weaves |
------------------------------------------------
{code:${orderId}; option:code128,45}
| Order Identifier Barcode: ${orderId} |
------------------------------------------------
{code:${digitalReceiptUrl}; option:qrcode}
| Scan for Verified Digital Receipt & Order Copy |
| Direct Online Verification: ${orderId} |
| Thank you for celebrating Indian Handloom Artisans! |
------------------------------------------------`;
}

export function preprocessDoc(rawDoc: string): string {
  return rawDoc
    .split('\n')
    .map((rawLine) => {
      let line = rawLine;

      line = line.replace(
        /\{code:([^;]+);\s*type:CODE128(?:;\s*height:(\d+))?\s*\}/gi,
        (_, code, height) => `{code:${code}; option:code128,${height || 50}}`
      );

      line = line.replace(
        /\{code:([^;]+);\s*type:QR(?:;\s*width:\d+)?\s*\}/gi,
        (_, code) => `{code:${code}; option:qrcode}`
      );

      line = line.replace(/\*\*([^*]+)\*\*/g, '"$1"');

      if (/^\s*\[C\]/i.test(line)) {
        const text = line.replace(/^\s*\[C\]\s*/i, '');
        return `| ${text} |`;
      }

      if (/^\s*\[L\]/i.test(line)) {
        const text = line.replace(/^\s*\[L\]\s*/i, '');
        return `|${text}`;
      }

      return line;
    })
    .join('\n');
}

/**
 * Wraps ReceiptLine SVG with a stylish rounded border box frame,
 * clean inner padding, and authentic solid paper card background.
 */
export function addRoundBoxToReceiptSvg(svgStr: string): string {
  const match = svgStr.match(/<svg\s+width="(\d+)px"\s+height="(\d+)px"\s+viewBox="0\s+0\s+(\d+)\s+(\d+)"/);
  if (!match) return svgStr;

  const [fullMatch, wStr, hStr] = match;
  const w = parseInt(wStr, 10);
  const h = parseInt(hStr, 10);
  const pad = 20;
  const newW = w + pad * 2;
  const newH = h + pad * 2;
  const radius = 20;

  const newSvgTag = `<svg width="${newW}px" height="${newH}px" viewBox="${-pad} ${-pad} ${newW} ${newH}"`;
  let res = svgStr.replace(fullMatch, newSvgTag);

  // Outer border with rounded corners and clean inner card fill
  const rect = `<rect x="${-pad + 3}" y="${-pad + 3}" width="${newW - 6}" height="${newH - 6}" rx="${radius}" ry="${radius}" fill="#ffffff" stroke="#1C1917" stroke-width="2.5"/>`;

  if (res.includes('</defs>')) {
    res = res.replace('</defs>', '</defs>' + rect);
  } else {
    res = res.replace(/>/, '>' + rect);
  }

  return res;
}

export function renderReceiptSvg(rawDoc: string, cpl = 44): string {
  const processed = preprocessDoc(rawDoc);
  const rawSvg = receiptline.transform(processed, {
    cpl,
    encoding: 'multilingual',
    spacing: true,
    command: 'svg',
  });
  return addRoundBoxToReceiptSvg(rawSvg);
}
