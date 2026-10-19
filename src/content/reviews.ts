// REVIEWS ARE VERBATIM GOOGLE REVIEWS.
// Every entry below is copied VERBATIM from the Google Business Profile reviews. Never invent,
// paraphrase, shorten, or correct review text, including spelling and punctuation. Paragraphs are
// joined with a blank line. Use the reviewer's first name and last initial, and their city only if
// it appears in the review profile.

export type Review = {
  name: string;
  city?: string;
  rating: number;
  text: string;
};

export const reviews: Review[] = [
  {
    name: "Jacob S.",
    rating: 5,
    text: [
      "Shelby Construction Services completely exceeded our expectations, and to say we are OVER THE MOON with the transformation of our home would still be an understatement. From the very beginning, their team was professional, knowledgeable, detail-oriented, and genuinely cared about the final result as if it were their own home.",
      "The transformation they achieved is incredible. Every time we pull into the driveway or walk through the front door, we cannot believe this is our house. The craftsmanship, attention to detail, and overall quality of work completely changed the appearance and feel of our home. The crew went above and beyond at every stage of the project to make sure everything was done right.",
      "What impressed us even more is that this project was not just about looks. Shelby Construction Services took the time to improve the functionality and efficiency of our home as well. The added roof ventilation and insulation behind the siding are improvements that will help protect our home and save money on utility bills for years to come. It is clear they understand how to combine aesthetics, performance, and long-term value.",
      "It is rare to find a company that delivers this level of professionalism, communication, and quality all in one package. We could not be happier with the outcome and would highly recommend Shelby Construction Services to anyone looking to truly transform their home.",
    ].join("\n\n"),
  },
  {
    name: "Felicia W.",
    rating: 5,
    text: [
      "I had an absolutely incredible experience with Tim and the entire team at Shelby Construction.",
      "A few years ago, I had a roof installed by another company, and unfortunately the project was plagued with ongoing issues that were never fully resolved. As I worked through the process of understanding what had gone wrong, Tim took the time to thoroughly inspect the roof, review the concerns, and help identify numerous installation deficiencies. He worked professionally with township officials and other third-party experts, and his findings consistently confirmed what I had been seeing firsthand.",
      "When it finally came time to replace the roof, there was no question who I wanted to hire.",
      "Tim and his team arrived bright and early and immediately impressed me with their organization, professionalism, and attention to detail. Before any work began, they carefully tarped the property to protect my home and landscaping and to ensure nails and debris were properly contained. The crew worked efficiently and cohesively throughout the day, completing the entire roof replacement while maintaining a clean and safe worksite.",
      "Most importantly, I now have confidence that the roof was installed correctly. The workmanship is outstanding, the finished product looks fantastic, and knowing the job was done right provides tremendous peace of mind.",
      "If you're looking for a roofing company that values quality, professionalism, and doing things the right way, I highly recommend Tim and the team at Shelby Construction. They exceeded my expectations, and I couldn't be happier with the results.",
    ].join("\n\n"),
  },
  {
    name: "Greg H.",
    rating: 5,
    text: "Shelby Construction installed a new roof on my house, garage, and shed this spring and it turned out great. Their crew was very professional, quick, and efficient. They left my yard and property very clean which I appreciated. I think the best part was they were at my house at 7am and were done at 2pm, so I appreciated how quickly the service was completed. Michael Cooley was great to work with, and I would highly recommend their operation to anyone in the Saint Clair Shores area. They were fair and honest. Don't just go with the first bid when you're looking, at the very least give Shelby a shot",
  },
];
