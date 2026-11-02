import { Faq } from "@/app/_components/landing/faq";
import { Features } from "@/app/_components/landing/features";
import { FinalCta } from "@/app/_components/landing/final-cta";
import { Hero } from "@/app/_components/landing/hero";
import { HowItWorks } from "@/app/_components/landing/how-it-works";
import { Problem } from "@/app/_components/landing/problem";
import { Safety } from "@/app/_components/landing/safety";
import { SiteFooter } from "@/app/_components/landing/site-footer";
import { SiteHeader } from "@/app/_components/landing/site-header";
import { TrustStrip } from "@/app/_components/landing/trust-strip";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <TrustStrip />
        <Problem />
        <HowItWorks />
        <Features />
        <Safety />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
