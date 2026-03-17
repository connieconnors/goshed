This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment variables

- **GOOGLE_PLACES_API_KEY** – Used for nearby donation/place suggestions and contextual suggestions on the confirmation screen. Create in [Google Cloud Console](https://console.cloud.google.com/) (Places API).
- **OPENWEATHERMAP_API_KEY** – Optional. Used for curb/large-item confirmation to show a rain heads-up. Free tier at [OpenWeatherMap](https://openweathermap.org/api). Add to `.env.local` as `OPENWEATHERMAP_API_KEY`.

## Supabase auth (sign-in link) in production

For sign-in link to work on your live site (e.g. goshed.app):

1. **Redirect URLs** – In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**, add your production callback to **Redirect URLs**, e.g.:
   - `https://goshed.app/auth/callback`
   - `https://www.goshed.app/auth/callback` (if you use www)
2. **Site URL** – Set **Site URL** to your production origin (e.g. `https://goshed.app`).

If the redirect URL isn’t allowlisted, Supabase can reject the magic-link request and the login page will show the error instead of “Check your email.”

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
