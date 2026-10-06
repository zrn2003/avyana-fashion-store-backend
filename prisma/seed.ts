import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Role, AuthProvider } from '../src/types';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for Boutique Fashion Platform...');

  // 1. Ensure Store Owner Admin Accounts
  const adminPasswordHash = await bcrypt.hash('Admin@12345', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { role: Role.ADMIN, passwordHash: adminPasswordHash },
    create: {
      fullName: 'Boutique Store Admin',
      email: 'admin@gmail.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      authProvider: AuthProvider.LOCAL,
      isEmailVerified: true,
    },
  });
  console.log(`✅ Store owner admin verified: ${adminUser.email}`);

  await prisma.user.upsert({
    where: { email: 'zishaninfo20@gmail.com' },
    update: { role: Role.ADMIN, passwordHash: adminPasswordHash },
    create: {
      fullName: 'Zishan Nadaf (Store Owner)',
      email: 'zishaninfo20@gmail.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      authProvider: AuthProvider.LOCAL,
      isEmailVerified: true,
    },
  });

  // 2. Categories
  const categoriesData = [
    {
      name: 'Chanderi & Maheshwari',
      slug: 'chanderi-maheshwari',
      imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Kota Doria & Dola Silk',
      slug: 'kota-doria-dola-silk',
      imageUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Mul & Pure Cotton',
      slug: 'mul-pure-cotton',
      imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Modal & Gajji Silk',
      slug: 'modal-gajji-silk',
      imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Chikankari & Tepchi Work',
      slug: 'chikankari-tepchi',
      imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
    },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    categories[cat.slug] = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, imageUrl: cat.imageUrl },
      create: cat,
    });
  }
  console.log('✅ Categories seeded');

  // 3. Products with Multi-images, Colors and Sizes
  const productsData = [
    {
      title: 'Handloom Chanderi Kurti Set in Natural Indigo',
      slug: 'handloom-chanderi-kurti-set-natural-indigo',
      categoryId: categories['chanderi-maheshwari'].id,
      description: 'Handcrafted by master weavers in Chanderi, Madhya Pradesh. Dyed with authentic botanical indigo and accented with subtle hand-woven zari borders. Features pure mulberry silk warp and fine cotton weft for a featherlight drape.',
      fabricCare: 'Pure Chanderi (Silk by Cotton). Botanical indigo dye. First wash strictly dry clean; subsequent washes gentle cold hand rinse without wringing.',
      basePrice: 3899.00,
      salePrice: 2499.00,
      isFeatured: true,
      images: [
        {
          r2Key: 'products/chanderi-indigo-1.webp',
          publicUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85',
          altText: 'Chanderi Kurti Indigo Front View',
          sortOrder: 0,
        },
        {
          r2Key: 'products/chanderi-indigo-2.webp',
          publicUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85',
          altText: 'Chanderi Weave and Zari Close-up',
          sortOrder: 1,
        },
      ],
      variants: [
        { sku: 'CHAN-IND-S', size: 'S', colorName: 'Indigo Blue', colorHex: '#1E3A8A', stockCount: 6 },
        { sku: 'CHAN-IND-M', size: 'M', colorName: 'Indigo Blue', colorHex: '#1E3A8A', stockCount: 10 },
        { sku: 'CHAN-IND-L', size: 'L', colorName: 'Indigo Blue', colorHex: '#1E3A8A', stockCount: 3 },
        { sku: 'CHAN-MAD-M', size: 'M', colorName: 'Madder Red', colorHex: '#991B1B', stockCount: 5 },
        { sku: 'CHAN-MAD-L', size: 'L', colorName: 'Madder Red', colorHex: '#991B1B', stockCount: 2 },
      ],
    },
    {
      title: 'Maheshwari Handloom Saree with Madder Root Dye',
      slug: 'maheshwari-handloom-saree-madder-root',
      categoryId: categories['chanderi-maheshwari'].id,
      description: 'Celebrated Maheshwari reversible border handloom weave crafted on wooden pit looms. Dyed naturally with herbal Manjistha (madder root), providing rich earthy terracotta tones that deepen gracefully over time.',
      fabricCare: 'Pure Maheshwari Silk-Cotton. 100% natural vegetable dyes. Dry clean recommended to preserve the metallic zari border luster.',
      basePrice: 4299.00,
      salePrice: 2899.00,
      isFeatured: true,
      images: [
        {
          r2Key: 'products/maheshwari-madder-1.webp',
          publicUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85',
          altText: 'Maheshwari Handloom Saree',
          sortOrder: 0,
        },
      ],
      variants: [
        { sku: 'MAH-MAD-FS', size: 'Free Size', colorName: 'Madder Terracotta', colorHex: '#9A3412', stockCount: 4 },
        { sku: 'MAH-TUR-FS', size: 'Free Size', colorName: 'Turmeric Haldi', colorHex: '#D97706', stockCount: 5 },
      ],
    },
    {
      title: 'Kota Doria Handcrafted Dupatta Suit in Botanical Dyes',
      slug: 'kota-doria-handcrafted-dupatta-suit',
      categoryId: categories['kota-doria-dola-silk'].id,
      description: 'Signature square-check "Khat" weave woven by master artisans in Rajasthan. Breathable, sheer, and gossamer-soft. Naturally dyed with harda (myrobalan) and pomegranate peels for authentic earthen undertones.',
      fabricCare: 'Pure Cotton Kota Doria. Dip and dry in shade. Use mild herbal shampoo or dry clean.',
      basePrice: 3299.00,
      salePrice: 2199.00,
      isFeatured: true,
      images: [
        {
          r2Key: 'products/kota-doria-1.webp',
          publicUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85',
          altText: 'Kota Doria Handcrafted Suit',
          sortOrder: 0,
        },
      ],
      variants: [
        { sku: 'KOTA-SGE-S', size: 'S', colorName: 'Sage Green', colorHex: '#4D7C0F', stockCount: 4 },
        { sku: 'KOTA-SGE-M', size: 'M', colorName: 'Sage Green', colorHex: '#4D7C0F', stockCount: 7 },
        { sku: 'KOTA-SGE-L', size: 'L', colorName: 'Sage Green', colorHex: '#4D7C0F', stockCount: 2 },
        { sku: 'KOTA-OCH-M', size: 'M', colorName: 'Golden Ochre', colorHex: '#B45309', stockCount: 5 },
      ],
    },
    {
      title: 'Mulmul Cotton Flared Anarkali in Natural Pomegranate & Lac',
      slug: 'mulmul-cotton-flared-anarkali-natural-dye',
      categoryId: categories['mul-pure-cotton'].id,
      description: 'Breathe effortless organic comfort with 100-count pure Mulmul cotton. Hand-block printed with wooden blocks using botanical lac resin and pomegranate peel mordants.',
      fabricCare: '100% Breathable Mul Cotton. Mild cold machine wash with pH-neutral detergent. Dry in shade.',
      basePrice: 2699.00,
      salePrice: 1799.00,
      isFeatured: false,
      images: [
        {
          r2Key: 'products/mul-cotton-1.webp',
          publicUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85',
          altText: 'Mul Cotton Flared Anarkali',
          sortOrder: 0,
        },
      ],
      variants: [
        { sku: 'MUL-LAC-S', size: 'S', colorName: 'Lac Coral', colorHex: '#BE123C', stockCount: 8 },
        { sku: 'MUL-LAC-M', size: 'M', colorName: 'Lac Coral', colorHex: '#BE123C', stockCount: 12 },
        { sku: 'MUL-LAC-L', size: 'L', colorName: 'Lac Coral', colorHex: '#BE123C', stockCount: 5 },
        { sku: 'MUL-LAC-XL', size: 'XL', colorName: 'Lac Coral', colorHex: '#BE123C', stockCount: 3 },
      ],
    },
    {
      title: 'Handcrafted Tepchi & Chikankari Pure Cotton Kurta',
      slug: 'handcrafted-tepchi-chikankari-pure-cotton-kurta',
      categoryId: categories['chikankari-tepchi'].id,
      description: 'Meticulous Awadhi needlecraft featuring long running Tepchi stitches and Bakhiya shadow embroidery hand-sewn by women artisans. Spun from premium pure long-staple cotton.',
      fabricCare: 'Pure Breathable Cotton. Hand embroidered. Hand wash inside-out or gentle cycle in laundry bag.',
      basePrice: 3499.00,
      salePrice: 2299.00,
      isFeatured: true,
      images: [
        {
          r2Key: 'products/chikankari-tepchi-1.webp',
          publicUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
          altText: 'Tepchi & Chikankari Kurta',
          sortOrder: 0,
        },
      ],
      variants: [
        { sku: 'TEP-IVY-S', size: 'S', colorName: 'Ivory White', colorHex: '#FDFBF7', stockCount: 6 },
        { sku: 'TEP-IVY-M', size: 'M', colorName: 'Ivory White', colorHex: '#FDFBF7', stockCount: 8 },
        { sku: 'TEP-IVY-L', size: 'L', colorName: 'Ivory White', colorHex: '#FDFBF7', stockCount: 4 },
        { sku: 'TEP-IVY-XL', size: 'XL', colorName: 'Ivory White', colorHex: '#FDFBF7', stockCount: 2 },
      ],
    },
    {
      title: 'Gajji Silk Ajrakh Kurti in Natural Mineral & Vegetable Dyes',
      slug: 'gajji-silk-ajrakh-kurti-natural-dyes',
      categoryId: categories['modal-gajji-silk'].id,
      description: 'Lustrous satin-finish Gajji silk adorned with 16-stage traditional Ajrakh hand-block printing. Prepared with natural indigo, madder, and ferrous harda for rich depth and fluid drape.',
      fabricCare: 'Pure Gajji Silk with natural dyes. Dry clean only to preserve natural luster and deep botanical pigments.',
      basePrice: 4899.00,
      salePrice: 3199.00,
      isFeatured: true,
      images: [
        {
          r2Key: 'products/gajji-silk-1.webp',
          publicUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85',
          altText: 'Gajji Silk Kurti',
          sortOrder: 0,
        },
      ],
      variants: [
        { sku: 'GAJ-AJR-S', size: 'S', colorName: 'Ajrakh Maroon', colorHex: '#7F1D1D', stockCount: 4 },
        { sku: 'GAJ-AJR-M', size: 'M', colorName: 'Ajrakh Maroon', colorHex: '#7F1D1D', stockCount: 6 },
        { sku: 'GAJ-AJR-L', size: 'L', colorName: 'Ajrakh Maroon', colorHex: '#7F1D1D', stockCount: 3 },
      ],
    },
  ];

  for (const prodData of productsData) {
    const { images, variants, ...prodFields } = prodData;

    const product = await prisma.product.upsert({
      where: { slug: prodFields.slug },
      update: prodFields,
      create: prodFields,
    });

    // Delete existing images & variants to avoid duplicates on re-seed
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    // Seed images
    for (const img of images) {
      await prisma.productImage.create({
        data: {
          ...img,
          productId: product.id,
        },
      });
    }

    // Seed variants
    for (const v of variants) {
      await prisma.productVariant.create({
        data: {
          ...v,
          productId: product.id,
        },
      });
    }

    console.log(`✅ Seeded Product: ${product.title} with ${variants.length} variants`);
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
