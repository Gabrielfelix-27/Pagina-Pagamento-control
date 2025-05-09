import React from 'react';
import Hero from '../components/Hero';
import FeatureSection from '../components/FeatureSection';
import PricingSection from '../components/PricingSection';
import TestimonialSection from '../components/TestimonialSection';
import FAQSection from '../components/FAQSection';
import CTASection from '../components/CTASection';

const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <FeatureSection />
      <PricingSection />
      <TestimonialSection />
      <FAQSection />
      <CTASection />
    </>
  );
};

export default HomePage;