export interface WhatsAppDispatchInput {
  phone: string;
  customerName: string;
  orderNumber: string;
  courierName: string;
  trackingAwb: string;
  trackingUrl?: string;
}

export class WhatsAppService {
  static generateDispatchUrl(input: WhatsAppDispatchInput): string {
    const { phone, customerName, orderNumber, courierName, trackingAwb, trackingUrl } = input;

    // Clean Indian 10-digit phone
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    const message = [
      `Hi ${customerName}! 🌿`,
      `Great news! Your order #${orderNumber} from Avyana Craft has been dispatched via ${courierName}.`,
      `📦 AWB Tracking No: ${trackingAwb}`,
      ...(trackingUrl ? [`🔗 Track Live Delivery: ${trackingUrl}`] : []),
      `Thank you for celebrating authentic handloom & natural dyes with us!`,
    ].join('\n\n');

    const encodedText = encodeURIComponent(message);
    return `https://wa.me/91${cleanPhone}?text=${encodedText}`;
  }
}
