import { GetServerSideProps } from 'next';
import Head from 'next/head';
import prisma from '@/lib/prisma';
import { StorefrontView, StorefrontConfig, StorefrontProduct, StorefrontOffer } from '@/components/storefront/storefront-view';

interface StorefrontPageProps {
  businessName: string;
  businessSlug: string;
  config: StorefrontConfig;
  products: StorefrontProduct[];
  offers: StorefrontOffer[];
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { businessSlug } = context.params as { businessSlug: string };

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    include: {
      storefront: true,
      products: true,
      combos: {
        where: { isActive: true },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  // The public storefront itself (not just its customization screen) is an
  // Enterprise-only feature — a Basic/Pro business's slug shouldn't resolve
  // to a working public page at all.
  if (!business || business.planName !== 'ENTERPRISE') return { notFound: true };

  const sf = business.storefront;

  // A combo's available stock is capped by its scarcest component — e.g. a
  // combo needing 2x of a product that only has 3 left can sell at most 1.
  const comboAvailableStock = (items: { productId: string; quantity: unknown }[]) => {
    if (items.length === 0) return 0;
    return Math.min(
      ...items.map((ci) => {
        const product = business.products.find((p) => p.id === ci.productId);
        return product ? Math.floor(Number(product.stock) / Number(ci.quantity)) : 0;
      })
    );
  };

  const config: StorefrontConfig = {
    heroTitle: sf?.heroTitle || `Bienvenido a ${business.name}`,
    heroSubtitle: sf?.heroSubtitle || 'Los mejores productos al mejor precio',
    heroImageUrl: sf?.heroImageUrl || null,
    primaryColor: sf?.primaryColor || '#3b82f6',
    secondaryColor: sf?.secondaryColor || '#3D9488',
    backgroundColor: sf?.backgroundColor || null,
    themeMode: sf?.themeMode || 'dark',
    fontPairing: sf?.fontPairing || 'walti',
    buttonStyle: sf?.buttonStyle || 'rounded',
    faviconUrl: sf?.faviconUrl || null,
    logoUrl: sf?.logoUrl || null,
    aboutText: sf?.aboutText || null,
    aboutImageUrl: sf?.aboutImageUrl || null,
    contactPhone: sf?.contactPhone || null,
    contactEmail: sf?.contactEmail || null,
    contactAddress: sf?.contactAddress || null,
    whatsappNumber: sf?.whatsappNumber || null,
  };

  return {
    props: {
      businessName: business.name,
      businessSlug: business.slug,
      config,
      products: business.products
        .filter((p) => Number(p.stock) > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price.toString(),
          imageUrl: p.imageUrl || null,
          stock: Number(p.stock),
          category: p.category || null,
        })),
      offers: business.combos
        .map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          price: c.price.toString(),
          imageUrl: c.imageUrl || null,
          stock: comboAvailableStock(c.items),
        }))
        .filter((c) => c.stock > 0),
    },
  };
};

export default function StorefrontPage({ businessName, businessSlug, config, products, offers }: StorefrontPageProps) {
  return (
    <>
      <Head>
        <title>{businessName} | Catálogo Online</title>
        <meta name="description" content={config.heroSubtitle} />
        {config.faviconUrl ? (
          <link rel="icon" href={config.faviconUrl} />
        ) : null}
      </Head>
      <StorefrontView
        businessName={businessName}
        businessSlug={businessSlug}
        config={config}
        products={products}
        offers={offers}
      />
    </>
  );
}
