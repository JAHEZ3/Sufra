import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('general_settings')
export class GeneralSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'platform_name', length: 150, default: 'جاهز' })
  platformName: string;

  @Column({ name: 'support_email', length: 150, default: 'support@jahaz.app' })
  supportEmail: string;

  @Column({ name: 'support_phone', length: 30, default: '920012345' })
  supportPhone: string;

  @Column({ name: 'support_whatsapp', length: 30, nullable: true })
  supportWhatsapp: string | null;

  @Column({ name: 'support_address', type: 'text', nullable: true })
  supportAddress: string | null;

  @Column({ name: 'support_hours', length: 200, nullable: true })
  supportHours: string | null;

  @Column({ name: 'default_language', length: 10, default: 'ar' })
  defaultLanguage: string;

  @Column({ length: 10, default: 'ILS' })
  currency: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  // ─── Social media links (public website footer) ───────────────────────
  @Column({ name: 'facebook_url', type: 'text', nullable: true })
  facebookUrl: string | null;

  @Column({ name: 'instagram_url', type: 'text', nullable: true })
  instagramUrl: string | null;

  @Column({ name: 'x_url', type: 'text', nullable: true })
  xUrl: string | null;

  @Column({ name: 'youtube_url', type: 'text', nullable: true })
  youtubeUrl: string | null;

  @Column({ name: 'tiktok_url', type: 'text', nullable: true })
  tiktokUrl: string | null;

  @Column({ name: 'snapchat_url', type: 'text', nullable: true })
  snapchatUrl: string | null;

  // ─── App store links (public website footer) ──────────────────────────
  @Column({ name: 'app_store_url', type: 'text', nullable: true })
  appStoreUrl: string | null;

  @Column({ name: 'google_play_url', type: 'text', nullable: true })
  googlePlayUrl: string | null;

  // ─── Public website CTA button URLs ───────────────────────────────────
  // Target routes for the "Register restaurant", "Register driver", and
  // "Download app" buttons shown across the marketing site (Navbar +
  // JoinUsSection). Null → the button stays but does nothing (or falls
  // back to an in-page anchor on the client side).
  @Column({ name: 'restaurant_signup_url', type: 'text', nullable: true })
  restaurantSignupUrl: string | null;

  @Column({ name: 'driver_signup_url', type: 'text', nullable: true })
  driverSignupUrl: string | null;

  @Column({ name: 'app_download_url', type: 'text', nullable: true })
  appDownloadUrl: string | null;

  // ─── SEO / social-share metadata (public website <head>) ──────────────
  @Column({ name: 'seo_title_template', length: 200, nullable: true })
  seoTitleTemplate: string | null;

  @Column({ name: 'seo_description', type: 'text', nullable: true })
  seoDescription: string | null;

  @Column({ name: 'seo_og_image_url', type: 'text', nullable: true })
  seoOgImageUrl: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
