/**
 * Telegram Notification Service (Explicitly Disabled / Disconnected)
 * Avyana Craft operates completely standalone without external Telegram dependencies.
 */
export interface OrderAlertData {
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  upiUtrNumber?: string | null;
}

export class TelegramService {
  static async sendOrderAlert(_data: OrderAlertData): Promise<void> {
    // External Telegram connection is intentionally disabled
    return;
  }
}
