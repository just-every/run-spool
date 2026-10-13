// Path data for the one continuous thread. Every piece joins its neighbours at a vertical or horizontal tangent
// at a shared point, so the line stays unbroken however the sections stretch. See Thread.tsx and landing.css.

/** Band strips: viewBox 100x400, entering and leaving at x=50 (the centre of the strip, the shared join). */
export const bandPaths = [
  'M50 0 C50 46 84 52 80 100 C76 150 20 146 22 200 C24 250 78 246 76 296 C74 340 50 344 50 400',
  'M50 0 C50 40 20 56 24 100 C28 142 80 138 78 190 C76 228 40 226 34 214 C26 198 46 178 64 192 C84 208 74 258 52 280 C34 300 30 340 50 400',
  'M50 0 C50 50 78 60 76 110 C74 160 24 150 26 206 C28 262 80 244 78 300 C76 350 50 348 50 400',
  'M50 0 C50 44 24 58 22 108 C20 150 70 156 74 204 C78 252 28 258 28 306 C28 350 50 350 50 400',
  'M50 0 C50 38 80 50 78 96 C76 138 36 132 42 120 C50 104 70 128 64 160 C58 198 22 196 24 246 C26 296 76 292 76 332 C76 366 50 358 50 400',
  'M50 0 C50 48 22 54 24 104 C26 154 80 150 80 204 C80 252 30 256 30 304 C30 348 50 346 50 400',
  'M50 0 C50 42 82 56 78 108 C74 160 26 142 24 196 C22 250 76 248 78 302 C80 352 50 350 50 400',
];

/** The hero's wide-screen header run, anchored to the hero band's top-left in px. */
export const heroLead = 'M51.4 91 C49 126 100 121 150 121';
/** Joins heroLead at (150,121); stretched across to the numeral column, ending 110px short of numeral 1's centre. */
export const heroRun = 'M0 121 C60 121 110 70 180 70 C250 70 280 123 350 123 C410 123 430 96 477 96';
/** Numeral knots, relative to each numeral's centre: arrive from above, loop on the left, pass behind the numeral, leave below. */
export const knots = [
  'M-110 -88 C-80 -86 -30 -112 12 -113 C52 -114 78 -96 62 -72 C48 -52 -26 -66 -40 -38 C-50 -14 -36 6 -20 0 C-8 -3 0 6 0 22 L0 44',
  'M0 -52 C2 -38 -32 -44 -48 -28 C-60 -14 -44 6 -20 0 C-8 -3 0 6 0 22 L0 44',
  'M0 -52 C0 -38 -22 -46 -42 -36 C-62 -26 -58 4 -36 4 C-28 4 -24 1 -20 0 C-8 -3 0 6 0 22 L0 44',
];
/** Stretched stretches between numerals (viewBox 80x100, x=60 is the numeral column's centre). */
export const stepSegments = [
  'M60 0 C60 24 18 32 22 56 C26 80 62 78 60 100',
  'M60 0 C60 22 12 38 26 62 C36 80 60 84 60 100',
  'M60 0 C60 26 30 30 28 54 C26 80 60 70 60 100',
];
/** Leaves the hero: from the numeral column down-left to the shared join (viewBox 100x96). */
export const heroTail = 'M100 0 C100 52 0 44 0 96';
/** Narrow screens: tail under the mark to the left margin (viewBox 100x33), and the left-margin-to-numeral S (viewBox 100x100). */
export const narrowLead = 'M100 0 C102.2 5 106 10 95.3 12.1 C76.5 13.1 46.4 12.6 27.5 12.3 C14 12.2 0 19 0 33';
export const narrowSwing = 'M0 0 C0 50 100 50 100 100';
export const narrowTail = 'M100 0 C100 50 0 50 0 100';

/** Footer, wide screens, relative to the join at the rule: down and in to the spool's winding. */
export const footerWide = 'M0 0 C0 26 4 46 -10 56 C-20 63 -30 63 -38 63';
/** Footer, narrow screens: strip piece is a bandPath-like stretch; this swings from the margin into the mirrored spool (viewBox 100x40). */
export const footerNarrow = 'M0 0 C0 24 60 10 100 40';

/** Wide screens: one stretched piece per band (viewBox 1000x1000, x is a thousandth of the page container). Each starts and ends at a
 *  vertical tangent on the band's top or bottom edge, so neighbours meet exactly at the shared x (the joins: 458.3, 488.3, 70.3, 220.3,
 *  804.7, 545, 557, 870.3, 960 (footer wind)). In "Try it" the line runs through the needle's eye: its two pieces meet at 545,
 *  the centre of the eye's slot (see .o-needle and .tw-try-a), and the needle is drawn over the line so only the open slot shows it. */
export const wide = {
  free: 'M458.3 0.0 C458.3 54.0 424.6 111.4 433.6 179.9 C442.6 248.5 505.9 334.2 511.7 411.3 C517.6 488.4 469.4 569.8 468.8 642.7 C468.1 715.5 504.6 788.8 507.8 848.3 C511.1 907.9 488.3 954.5 488.3 1000',
  agents: 'M488.3 0.0 C488.3 54.5 462.9 116.3 449.2 181.6 C435.5 247.0 415.4 325.0 406.2 392.0 C397.1 458.9 404.9 530.6 394.5 583.2 C384.1 635.8 370.4 667.6 343.8 707.5 C317.1 747.3 268.2 787.8 234.4 822.2 C200.5 856.6 165.4 890.1 140.6 914.0 C115.9 937.9 97.7 951.2 85.9 965.6 C74.2 979.9 70.3 989.7 70.3 1000',
  regressionsA: 'M70.3 0.0 C70.3 145.5 61.2 319.4 54.7 485.1 C48.2 650.9 31.25 841.7 31.25 1000',
  regressionsB: 'M31.25 0.0 C31.25 93.4 31.2 217.1 32.8 311.4 C34.4 405.8 33.7 492.5 40.6 566.3 C47.5 640.0 63.4 704.9 74.2 753.8 C85.0 802.8 93.1 831.1 105.5 860.0 C117.8 888.9 134.1 908.4 148.4 927.3 C162.8 946.1 179.4 960.9 191.4 973.3 C203.4 985.7 220.3 993.1 220.3 1000',
  private: 'M220.3 0.0 C220.3 28.3 249.0 59.4 273.4 94.3 C297.9 129.3 338.5 167.7 367.2 209.6 C395.8 251.6 427.1 297.0 445.3 345.9 C463.5 394.8 467.4 456.0 476.6 503.1 C485.7 550.3 489.6 590.5 500.0 628.9 C510.4 667.4 520.8 699.5 539.1 733.8 C557.3 768.0 584.6 807.1 609.4 834.4 C634.1 861.6 662.8 880.5 687.5 897.3 C712.2 914.0 739.3 924.5 757.8 935.0 C776.3 945.5 790.6 949.3 798.4 960.2 C806.2 971.0 804.7 988.1 804.7 1000',
  archive: 'M804.7 0.0 C804.7 24.1 802.7 47.6 796.9 80.4 C791.0 113.1 781.9 153.3 769.5 196.4 C757.2 239.6 734.4 291.7 722.7 339.3 C710.9 386.9 712.9 433.0 699.2 482.1 C685.5 531.2 657.6 584.8 640.6 633.9 C623.7 683.0 610.0 732.1 597.7 776.8 C585.3 821.4 575.2 864.6 566.4 901.8 C557.6 939.0 545.0 970.5 545.0 1000',
  /** Falls to the needle's eye and ends at the centre of its slot, upright (the needle is anchored so that centre sits on x=545). */
  tryA: 'M545.0 0.0 C545.0 107.1 525.5 244.0 527.3 357.1 C529.2 470.2 543.0 540.0 545.4 640.0 C547.8 740.0 545.0 860.0 545.0 1000',
  /** Leaves the eye's centre upright, behind the needle's lower rim, and runs on to the next band. */
  tryB: 'M545.0 0.0 C545.0 77.8 572.9 161.1 571.9 259.3 C570.9 357.5 552.5 465.8 550.0 589.3 C547.5 712.7 557.0 876.8 557.0 1000',
  run: 'M557.0 0.0 C557.0 40.7 564.2 84.7 574.2 135.6 C584.2 186.4 602.2 245.8 617.2 305.1 C632.2 364.4 648.4 432.2 664.1 491.5 C679.7 550.8 693.4 610.2 710.9 661.0 C728.5 711.9 750.0 755.6 769.5 796.6 C789.1 837.6 811.3 872.9 828.1 906.8 C844.9 940.7 870.3 972.0 870.3 1000',
  close: 'M870.3 0.0 C870.3 36.9 893.1 73.9 906.2 123.2 C919.4 172.4 944.7 238.1 949.2 295.6 C953.8 353.0 931.4 406.4 933.6 468.0 C935.8 529.6 958.1 603.4 962.5 665.0 C966.9 726.6 960.5 781.6 960.2 837.4 C959.8 893.3 960 951.2 960 1000',
};
/** Wide screens: the loop beside the "Know when it comes back." heading, a fixed-size drawing anchored at the join where its two pieces meet. */
export const loop = 'M0 0 C0 24 34 30 34 56 C34 82 -18 86 -22 60 C-26 36 14 28 22 52 C30 76 4 96 0 120';
/** Phones: the line crosses the page between two bands, from the left margin strip to the right one and back (viewBox 100x100). */
export const crossLR = 'M0 0 C0 50 100 50 100 100';
export const crossRL = 'M100 0 C100 50 0 50 0 100';
