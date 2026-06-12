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
};

export default nextConfig;
