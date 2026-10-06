import { prisma } from '../../config/prisma';

export interface StoreSettingUpdateInput {
  storeName?: string;
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string;
  upiVpa?: string;
  upiPayeeName?: string;
  codFee?: number;
  freeShippingThreshold?: number;
  standardShippingFee?: number;
  announcementText?: string;
  isAnnouncementActive?: boolean;
}

export class SettingsService {
  static async getSettings() {
    let settings = await (prisma as any).storeSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await (prisma as any).storeSetting.create({
        data: {
          id: 'default',
          storeName: 'Avyana Craft',
          supportEmail: 'care@avyanacraft.com',
          supportPhone: '+91 98220 12345',
          whatsappNumber: '+919822012345',
          upiVpa: 'avyanacraft@okaxis',
          upiPayeeName: 'AVYANA CRAFT',
          codFee: 50.0,
          freeShippingThreshold: 1499.0,
          standardShippingFee: 99.0,
          announcementText: '🌿 Avyana Craft Festive Weaves Live • Pure Handloom & Natural Dyes • Chanderi, Maheshwari & Kota Doria • Free Express Delivery on ₹1,499+ • Dedicated Client Care',
          isAnnouncementActive: true,
        },
      });
    }

    return settings;
  }

  static async updateSettings(input: StoreSettingUpdateInput) {
    return (prisma as any).storeSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(input.storeName !== undefined && { storeName: input.storeName }),
        ...(input.supportEmail !== undefined && { supportEmail: input.supportEmail }),
        ...(input.supportPhone !== undefined && { supportPhone: input.supportPhone }),
        ...(input.whatsappNumber !== undefined && { whatsappNumber: input.whatsappNumber }),
        ...(input.upiVpa !== undefined && { upiVpa: input.upiVpa }),
        ...(input.upiPayeeName !== undefined && { upiPayeeName: input.upiPayeeName }),
        ...(input.codFee !== undefined && { codFee: Number(input.codFee) }),
        ...(input.freeShippingThreshold !== undefined && { freeShippingThreshold: Number(input.freeShippingThreshold) }),
        ...(input.standardShippingFee !== undefined && { standardShippingFee: Number(input.standardShippingFee) }),
        ...(input.announcementText !== undefined && { announcementText: input.announcementText }),
        ...(input.isAnnouncementActive !== undefined && { isAnnouncementActive: Boolean(input.isAnnouncementActive) }),
      },
      create: {
        id: 'default',
        storeName: input.storeName || 'Avyana Craft',
        supportEmail: input.supportEmail || 'care@avyanacraft.com',
        supportPhone: input.supportPhone || '+91 98220 12345',
        whatsappNumber: input.whatsappNumber || '+919822012345',
        upiVpa: input.upiVpa || 'avyanacraft@okaxis',
        upiPayeeName: input.upiPayeeName || 'AVYANA CRAFT',
        codFee: input.codFee !== undefined ? Number(input.codFee) : 50.0,
        freeShippingThreshold: input.freeShippingThreshold !== undefined ? Number(input.freeShippingThreshold) : 1499.0,
        standardShippingFee: input.standardShippingFee !== undefined ? Number(input.standardShippingFee) : 99.0,
        announcementText: input.announcementText || '🌿 Avyana Craft Festive Weaves Live • Pure Handloom & Natural Dyes • Chanderi, Maheshwari & Kota Doria • Free Express Delivery on ₹1,499+ • Dedicated Client Care',
        isAnnouncementActive: input.isAnnouncementActive !== undefined ? Boolean(input.isAnnouncementActive) : true,
      },
    });
  }
}
