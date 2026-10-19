import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Estimate } from "@/components/sections/Estimate";
import { Hero } from "@/components/sections/Hero";
import { Pricing } from "@/components/sections/Pricing";
import { Process } from "@/components/sections/Process";
import { Proof } from "@/components/sections/Proof";
import { Reviews } from "@/components/sections/Reviews";
import { Services } from "@/components/sections/Services";
import { Standard } from "@/components/sections/Standard";
import { resolveMedia } from "@/lib/media/resolve";

export default function HomePage() {
  const media = resolveMedia();

  return (
    <>
      <Header />
      <main>
        <Hero media={media.hero} />
        <Standard />
        <Services media={{ roofing: media.roofing, siding: media.siding, windows: media.windows, gutters: media.gutters }} />
        <Proof media={{ proofMorph: media.proofMorph, proofBefore: media.proofBefore, proofAfter: media.proofAfter }} />
        <Reviews />
        <Process />
        <Pricing />
        <Estimate />
      </main>
      <Footer />
    </>
  );
}
