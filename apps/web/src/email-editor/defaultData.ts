import type { EmailData } from '@ppt-generator/shared'

export const defaultEmailData: EmailData = {
  header: {
    logo: 'https://gd-hbimg.huaban.com/4a592b4730e2b4ebf6c9ab7dc6a27aaa139812c47d29-3Wrjs3',
    subtitle: 'EMPOWERING BRANDS, ELEVATING CREATORS',
  },
  hero: { title: 'DEALS OF THE WEEK' },
  topDeals: [
    {
      brand: 'LAURA GELLER',
      text: 'Up To 50% Off Site Wide + Extra 10% Off + 1/2 Off Blushes!',
      img: 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=340&h=220&dpr=2&fit=crop',
      link: 'https://www.laurageller.com',
    },
    {
      brand: 'CRICUT',
      text: 'Up to 50% off bundles, up to 80% OFF on Materials & Accessories.',
      img: 'https://images.pexels.com/photos/4226896/pexels-photo-4226896.jpeg?auto=compress&cs=tinysrgb&w=340&h=220&dpr=2&fit=crop',
      link: 'https://cricut.com',
    },
    {
      brand: 'BURROW',
      text: 'Up to 60% Off Sale Moved to Wednesday, August 21st!',
      img: 'https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=340&h=220&dpr=2&fit=crop',
      link: 'https://burrow.com',
    },
  ],
  date: '21th OF Aug',
  feature: {
    title: 'TOP FEATURED OFFER',
    intro: 'NEW from AirEssentials',
    mainImg: 'https://images.pexels.com/photos/9558577/pexels-photo-9558577.jpeg?auto=compress&cs=tinysrgb&w=600&h=700&dpr=1&fit=crop',
    prodName: 'AirEssentials Gathered Waist Dress',
    btnText: 'VISIT NOW',
    btnLink: '#',
    details: [
      { img: 'https://images.pexels.com/photos/720606/pexels-photo-720606.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=1&fit=crop', text: 'Light-as-air fabric' },
      { img: 'https://images.pexels.com/photos/4937222/pexels-photo-4937222.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=1&fit=crop', text: 'Fine knit structure' },
      { img: 'https://images.pexels.com/photos/4937224/pexels-photo-4937224.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=1&fit=crop', text: '4-way stretch' },
    ],
  },
  fashion: [
    { brand: 'SPANX', name: 'Longline Medium Impact Sports Bra', discount: '70% OFF', img: 'https://images.pexels.com/photos/3094215/pexels-photo-3094215.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
    { brand: 'SPANX', name: 'AirEssentials Tie-Waist Bermuda', discount: '50% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1591195853828-11db59a44f6b&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: 'SPANX', name: 'Suit Yourself V-Neck Ribbed Bodysuit', discount: '50% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1583846783214-7229a91b20ed&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: 'MR PORTER', name: 'N.05 Round-Frame Acetate Sunglasses', discount: '30% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1577803645773-f96470509666&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: "David's Bridal", name: 'Tulle and Beaded Lace Wedding Dress', discount: '40% OFF', img: 'https://images.pexels.com/photos/258421/pexels-photo-258421.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
    { brand: 'MR PORTER', name: 'Pursuit Logo-Embossed Rubber Slides', discount: '25% OFF', img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=375&q=80', link: '#' },
  ],
  beauty: [
    { brand: 'LOOKFANTASTIC', name: 'Garnier Ambre Solaire Protection Spray', discount: '20% OFF', img: 'https://images.weserv.nl/?url=images.unsplash.com/photo-1620916566398-39f1143ab7be&w=300&h=375&fit=cover&q=80&output=jpg', link: '#' },
    { brand: 'LOOKFANTASTIC', name: 'NARS Radiant Creamy Concealer', discount: '15% OFF', img: 'https://images.pexels.com/photos/4938506/pexels-photo-4938506.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
    { brand: 'LOOKFANTASTIC', name: 'Estée Lauder Double Wear Stay-in-Place', discount: '20% OFF', img: 'https://images.pexels.com/photos/3334759/pexels-photo-3334759.jpeg?auto=compress&cs=tinysrgb&w=300&h=375&dpr=1&fit=crop', link: '#' },
  ],
}
