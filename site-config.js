/* ================================================================
   MainlyKavi: site content. Edit this file, not the pages.

   Rules of thumb
   - `enabled: false` hides an entry everywhere. Leave `url: ''` until
     you have a real, public link; empty URLs are never rendered.
   - Nothing marked `placeholder: true` is shown on any deployed URL.
     Placeholders only appear on a local dev server (localhost).
   - Paths starting with / are files in this repo (e.g. /assets/kit/...).
   ================================================================ */
window.MK = {
  name: 'MainlyKavi',
  realName: 'Kavi Goutam',
  site: 'https://mainlykavi.com',

  contact: {
    email: 'collabs@mainlykavi.com',
    subject: 'Collab inquiry: [your brand]',
    body: 'Hey Kavi,\n\nBrand / company:\nWhat we have in mind:\nDeliverables & platforms:\nTimeline:\nBudget (rough is fine):\n\n'
  },

  /* Homepage line under the name. The first one shows on load; tapping it
     cycles through the rest. */
  taglines: [
    'if I got any cooler I’d freeze to death',
    'hottest planet in the solar system',
    'unnecessarily hot',
    'professionally unserious',
    'chaos, but make it content'
  ],

  /* Section A on /socials. `primary` ones get big tiles and appear on the
     homepage icon rail (in this order) when `rail: true`. */
  socials: [
    { id: 'youtube',   label: 'YouTube',   handle: '@MainlyKavi',   url: 'https://www.youtube.com/@MainlyKavi',            primary: true, rail: true },
    { id: 'instagram', label: 'Instagram', handle: '@mainlykavi',   url: 'https://www.instagram.com/mainlykavi',           primary: true, rail: true },
    { id: 'tiktok',    label: 'TikTok',    handle: '@Mainlykavi',   url: 'https://www.tiktok.com/@Mainlykavi',             primary: true, rail: true },
    { id: 'x',         label: 'X',         handle: '@MainlyKavi',   url: 'https://x.com/Mainlykavi',                       primary: true, rail: true },
    { id: 'snapchat',  label: 'Snapchat',  handle: '@mainlykavi',   url: 'https://www.snapchat.com/@mainlykavi',           primary: true },
    { id: 'facebook',  label: 'Facebook',  handle: 'MainlyKavi',    url: 'https://www.facebook.com/MainlyKavi',            primary: true, rail: true },
    { id: 'bluesky',   label: 'Bluesky',   handle: '@mainlykavi',   url: 'https://bsky.app/profile/mainlykavi.bsky.social' },
    { id: 'twitch',    label: 'Twitch',    handle: 'MainlyKavi',    url: 'https://www.twitch.tv/MainlyKavi' },
    { id: 'kick',      label: 'Kick',      handle: 'mainlykavi',    url: 'https://kick.com/mainlykavi' },
    { id: 'discord',   label: 'Discord',   handle: 'Profile',       url: 'https://discord.com/users/690044658579275791' },
    { id: 'reddit',    label: 'Reddit',    handle: 'u/MainlyKavi',  url: 'https://www.reddit.com/user/MainlyKavi' },
    { id: 'pinterest', label: 'Pinterest', handle: 'MainlyKavi',    url: 'https://www.pinterest.com/MainlyKavi' },
    { id: 'chess',     label: 'Chess.com', handle: 'mainlykavi',    url: 'https://www.chess.com/member/mainlykavi' },
    /* Off by default: different handle or not creator-facing. Flip to true to show. */
    { id: 'spotify',   label: 'Spotify',   handle: 'BuraAdmi',      url: 'https://open.spotify.com/user/BuraAdmi',  enabled: false },
    { id: 'github',    label: 'GitHub',    handle: 'MainlyKavi',    url: 'https://github.com/MainlyKavi',           enabled: false },
    { id: 'modrinth',  label: 'Modrinth',  handle: 'BuraAdmi',      url: 'https://modrinth.com/user/BuraAdmi',      enabled: false },
    { id: 'peerlist',  label: 'Peerlist',  handle: 'mainlykavi',    url: 'https://peerlist.io/mainlykavi',          enabled: false }
  ],

  /* Section B on /socials. Public creator profiles or portfolio pages ONLY.
     Never a dashboard, application page or anything behind a login. */
  ugc: [
    { id: 'zorrid',      label: 'Zorrid',      note: 'Creator media kit',  url: 'https://zorrid.link/mainlykavi/kit' },
    { id: 'launchpoint', label: 'Launchpoint', note: 'UGC portfolio',      url: '' },
    { id: 'darkugc',     label: 'DarkUGC',     note: 'UGC portfolio',      url: '' },
    { id: 'sideshift',   label: 'SideShift',   note: 'Creator profile',    url: '' },
    { id: 'collabstr',   label: 'Collabstr',   note: 'Creator profile',    url: '' }
  ],

  /* Section C on /socials. `kind: 'shop'` reads as a shop, not a tip jar. */
  support: [
    { id: 'throne',    label: 'Throne',          note: 'Gift me something off the wishlist', url: 'https://throne.com/mainlykavi', kind: 'support' },
    { id: 'kofi',      label: 'Ko-fi',           note: 'Buy me a coffee, one-off or monthly', url: 'https://ko-fi.com/mainlykavi',  kind: 'support' },
    { id: 'bmc',       label: 'Buy Me a Coffee', note: 'Same energy, different cup',          url: '',                              kind: 'support' },
    { id: 'gumroad',   label: 'Gumroad',         note: 'Things I made that you can buy',      url: '',                              kind: 'shop' }
  ],

  /* Homepage "Buy me a coffee" button. */
  coffeeUrl: 'https://throne.com/mainlykavi',

  kit: {
    /* Hero portrait, 4:5, at least 1200px wide (webp or jpg). */
    portrait: { src: '', alt: 'Kavi Goutam', placeholder: true },

    /* Exactly three vertical (9:16) samples. For each one use EITHER
       `video` (a file in /assets/kit/, mp4/H.264 with sound off by default)
       OR `url` (YouTube Shorts / Instagram / TikTok link), plus a
       `thumbnail` (9:16 image). Keep `placeholder: true` until it's real. */
    videos: [
      { title: 'Sample 01', caption: 'UGC ad slot: product demo, hook in the first second', thumbnail: '', video: '', url: '', placeholder: true },
      { title: 'Sample 02', caption: 'UGC ad slot: talking-head review, real reactions',     thumbnail: '', video: '', url: '', placeholder: true },
      { title: 'Sample 03', caption: 'Brand integration slot: a bit, then the product',      thumbnail: '', video: '', url: '', placeholder: true }
    ],

    /* Brand marquee. Stays hidden until `enabled: true` AND at least one
       real, approved brand is listed. Logos: SVG or transparent PNG in
       /assets/brands/. Only list brands you have actually worked with. */
    brands: {
      enabled: false,
      items: [
        /* { name: 'Brand name', logo: '/assets/brands/brand.svg', url: 'https://brand.com' } */
      ]
      /* Fictional demo wordmarks for testing the marquee live in
         lab/demo-content.js, which is never deployed (.vercelignore). */
    }
  }
};
