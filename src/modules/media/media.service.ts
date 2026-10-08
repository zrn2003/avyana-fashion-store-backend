import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import crypto from 'crypto';

export interface PresignedUrlInput {
  filename: string;
  fileType: string;
  folder?: string;
}

export class MediaService {
  private static getS3Client(): S3Client | null {
    // 1. Neon S3-Compatible Object Storage
    if (
      env.AWS_ENDPOINT_URL_S3 &&
      env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY
    ) {
      return new S3Client({
        region: env.AWS_REGION || 'us-east-2',
        endpoint: env.AWS_ENDPOINT_URL_S3,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });
    }

    // 2. Cloudflare R2 Media Storage Fallback
    if (
      env.CLOUDFLARE_R2_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ) {
      return new S3Client({
        region: 'auto',
        endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
          secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
      });
    }

    return null;
  }

  private static getBucketName(): string {
    if (env.AWS_ENDPOINT_URL_S3) {
      return env.AWS_S3_BUCKET_NAME || 'fashion-store-data-img';
    }
    return env.CLOUDFLARE_R2_BUCKET_NAME || 'boutique-assets';
  }

  private static getPublicUrl(key: string): string {
    if (env.AWS_ENDPOINT_URL_S3) {
      const base = env.AWS_ENDPOINT_URL_S3.replace(/\/+$/, '');
      const bucket = this.getBucketName();
      return `${base}/${bucket}/${key}`;
    }
    return `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
  }

  static async generatePresignedUrl(input: PresignedUrlInput) {
    const { filename, fileType, folder = 'products' } = input;

    // Validate MIME types according to SRS-MED-02
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      const error: any = new Error(
        'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.'
      );
      error.statusCode = 400;
      throw error;
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const uniqueKey = `${folder}/${timestamp}-${crypto.randomBytes(4).toString('hex')}-${cleanFilename}`;

    const s3 = this.getS3Client();

    if (!s3) {
      // Mock / Local Development Presigned URL fallback
      console.log(`📢 [Storage Mock]: Generated simulated presigned URL for ${uniqueKey}`);
      return {
        uploadUrl: `/api/v1/media/mock-upload?key=${encodeURIComponent(uniqueKey)}`,
        publicUrl: `${env.CLOUDFLARE_R2_PUBLIC_URL}/${uniqueKey}`,
        r2Key: uniqueKey,
      };
    }

    const bucket = this.getBucketName();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueKey,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes (SRS-MED-01)
    const publicUrl = this.getPublicUrl(uniqueKey);

    return {
      uploadUrl,
      publicUrl,
      r2Key: uniqueKey,
    };
  }

  static async registerAsset(input: {
    r2Key: string;
    publicUrl: string;
    filename: string;
    fileType: string;
    fileSize?: number;
    folder?: string;
    altText?: string;
  }) {
    const { prisma } = await import('../../config/prisma');
    return (prisma as any).mediaAsset.upsert({
      where: { r2Key: input.r2Key },
      update: {
        publicUrl: input.publicUrl,
        filename: input.filename,
        fileType: input.fileType,
        fileSize: input.fileSize,
        folder: input.folder || 'products',
        altText: input.altText,
      },
      create: {
        r2Key: input.r2Key,
        publicUrl: input.publicUrl,
        filename: input.filename,
        fileType: input.fileType,
        fileSize: input.fileSize,
        folder: input.folder || 'products',
        altText: input.altText,
      },
    });
  }

  static async listAssets(folder?: string, search?: string) {
    const { prisma } = await import('../../config/prisma');

    const where: any = {};
    if (folder && folder !== 'all') {
      where.folder = folder;
    }
    if (search) {
      where.OR = [
        { filename: { contains: search } },
        { altText: { contains: search } },
        { r2Key: { contains: search } },
      ];
    }

    const [assets, productImages] = await Promise.all([
      (prisma as any).mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productImage.findMany({
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Format all assets
    const registeredKeys = new Set(assets.map((a: { r2Key: string }) => a.r2Key));
    const combined = [
      ...assets.map((a: any) => ({
        id: a.id,
        r2Key: a.r2Key,
        publicUrl: a.publicUrl,
        filename: a.filename,
        fileType: a.fileType,
        fileSize: a.fileSize,
        folder: a.folder,
        altText: a.altText,
        createdAt: a.createdAt,
        source: 'standalone' as const,
        product: null,
      })),
      ...productImages
        .filter((pi: any) => !registeredKeys.has(pi.r2Key))
        .map((pi: any) => ({
          id: pi.id,
          r2Key: pi.r2Key,
          publicUrl: pi.publicUrl,
          filename: pi.r2Key.split('/').pop() || 'product-image',
          fileType: 'image/webp',
          fileSize: null,
          folder: 'products',
          altText: pi.altText || pi.product?.title,
          createdAt: pi.createdAt,
          source: 'product' as const,
          product: pi.product,
        })),
    ];

    return combined.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static async deleteAsset(id: string) {
    const { prisma } = await import('../../config/prisma');

    const s3 = this.getS3Client();

    // Check mediaAsset
    const asset = await (prisma as any).mediaAsset.findUnique({ where: { id } });
    if (asset) {
      if (s3 && asset.r2Key) {
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: this.getBucketName(),
              Key: asset.r2Key,
            })
          );
        } catch (err) {
          console.warn(`Failed to delete object ${asset.r2Key} from S3 storage:`, err);
        }
      }
      return (prisma as any).mediaAsset.delete({ where: { id } });
    }

    // Check productImage
    const img = await prisma.productImage.findUnique({ where: { id } });
    if (img) {
      if (s3 && img.r2Key) {
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: this.getBucketName(),
              Key: img.r2Key,
            })
          );
        } catch (err) {
          console.warn(`Failed to delete object ${img.r2Key} from S3 storage:`, err);
        }
      }
      return prisma.productImage.delete({ where: { id } });
    }

    const error: any = new Error('Asset not found');
    error.statusCode = 404;
    throw error;
  }
}

