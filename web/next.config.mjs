/** @type {import('next').NextConfig} */
const nextConfig = {
  // REQUIRED for pdfkit on Vercel: pdfkit's standard fonts (Helvetica, Courier)
  // load .afm metric files from node_modules/pdfkit/js/data at runtime. Next's
  // output file tracing does not detect these dynamic reads and drops them from
  // the serverless bundle, so /api/report works locally and throws
  // ENOENT (Helvetica.afm) only in production. This entry forces inclusion.
  outputFileTracingIncludes: {
    "/api/report": ["./node_modules/pdfkit/js/data/**"],
  },

  // Security headers — applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Stop MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS for 1 year, include subdomains
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // No referrer to third-party sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict permissions
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          // XSS protection for older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Content Security Policy
          // 'unsafe-inline' required for Tailwind inline styles
          // basescan.org and arbiscan.io for block explorer links in iframes (none used currently)
          // cdn.jsdelivr.net not used — keeping CSP tight
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + Next.js inline hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: self + Tailwind inline
              "style-src 'self' 'unsafe-inline'",
              // Images: self + data URIs (for PDF blob previews)
              "img-src 'self' data: blob:",
              // Fonts: self only
              "font-src 'self'",
              // Connect: self + Stripe + Upstash + S3/R2 presigned uploads
              // S3_ENDPOINT varies by deployment — keep connect-src broad for presigned URLs
              "connect-src 'self' https://api.stripe.com https://*.upstash.io https://*.r2.cloudflarestorage.com https://*.s3.amazonaws.com",
              // Frames: Stripe checkout hosted page
              "frame-src https://checkout.stripe.com https://js.stripe.com",
              // Form actions: self only
              "form-action 'self'",
              // Base URI: self only
              "base-uri 'self'",
              // Object src: none
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      // Relax CSP for Stripe.js script on pricing/checkout pages
      // (Stripe.js needs to be loaded from js.stripe.com)
      {
        source: "/(pricing|dashboard|billing-issue)(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.stripe.com",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com https://*.upstash.io https://*.r2.cloudflarestorage.com https://*.s3.amazonaws.com",
              "frame-src https://checkout.stripe.com https://js.stripe.com",
              "form-action 'self' https://checkout.stripe.com",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
