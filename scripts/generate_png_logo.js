import sharp from 'sharp';
import fs from 'fs';

// Accurate SVG replica of the uploaded Artboard 1 (1).png logo:
// - Left: Black background box with blue top line, stylized handwritten "EXAM" in bright sky-blue (#009fe3), blue bottom line
// - Right: Orange rectangle box (#f25f22) with handwritten white "FRIENDLY"
const fullLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="1000" height="320">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700;900&amp;family=Gloria+Hallelujah&amp;family=Patrick+Hand&amp;family=Plus+Jakarta+Sans:wght@800;900&amp;display=swap');
      .exam-font {
        font-family: 'Gloria Hallelujah', 'Caveat', 'Comic Sans MS', cursive, sans-serif;
        font-weight: 900;
        font-size: 106px;
        fill: #009fe3;
        letter-spacing: 2px;
      }
      .friendly-font {
        font-family: 'Gloria Hallelujah', 'Caveat', 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif;
        font-weight: 900;
        font-size: 104px;
        fill: #ffffff;
        letter-spacing: 3px;
        filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.3));
      }
      .tagline-font {
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        font-weight: 800;
        font-size: 24px;
        fill: #0f172a;
        letter-spacing: 0.5px;
      }
    </style>
  </defs>

  <!-- Left Black Container for EXAM -->
  <rect x="50" y="40" width="310" height="170" rx="4" fill="#000000" />
  
  <!-- Top Blue Bar -->
  <rect x="50" y="40" width="310" height="15" fill="#009fe3" />
  
  <!-- EXAM text -->
  <text x="205" y="156" text-anchor="middle" class="exam-font">EXAM</text>
  
  <!-- Bottom Blue Bar -->
  <rect x="50" y="195" width="310" height="15" fill="#009fe3" />

  <!-- Right Orange Container for FRIENDLY -->
  <rect x="360" y="40" width="590" height="170" fill="#f25f22" />
  
  <!-- FRIENDLY text -->
  <text x="655" y="160" text-anchor="middle" class="friendly-font">FRIENDLY</text>

  <!-- Tagline underneath (Optional clean brand banner) -->
  <text x="500" y="270" text-anchor="middle" class="tagline-font">Unlock Your Potential with Exam Friendly Tutorials</text>
</svg>`;

// Pure Badge Logo (without tagline, exactly as uploaded)
const pureBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 210" width="960" height="210">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700;900&amp;family=Gloria+Hallelujah&amp;family=Patrick+Hand&amp;display=swap');
      .exam-font {
        font-family: 'Gloria Hallelujah', 'Caveat', 'Comic Sans MS', cursive, sans-serif;
        font-weight: 900;
        font-size: 116px;
        fill: #009fe3;
        letter-spacing: 2px;
      }
      .friendly-font {
        font-family: 'Gloria Hallelujah', 'Caveat', 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif;
        font-weight: 900;
        font-size: 114px;
        fill: #ffffff;
        letter-spacing: 3px;
        filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.35));
      }
    </style>
  </defs>

  <!-- Left Black Container for EXAM -->
  <rect x="20" y="15" width="320" height="180" rx="4" fill="#000000" />
  
  <!-- Top Blue Bar -->
  <rect x="20" y="15" width="320" height="16" fill="#009fe3" />
  
  <!-- EXAM text -->
  <text x="180" y="140" text-anchor="middle" class="exam-font">EXAM</text>
  
  <!-- Bottom Blue Bar -->
  <rect x="20" y="179" width="320" height="16" fill="#009fe3" />

  <!-- Right Orange Container for FRIENDLY -->
  <rect x="340" y="15" width="600" height="180" fill="#f25f22" />
  
  <!-- FRIENDLY text -->
  <text x="640" y="144" text-anchor="middle" class="friendly-font">FRIENDLY</text>
</svg>`;

async function generateLogos() {
  if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
  }

  // 1. Generate full logo with tagline
  await sharp(Buffer.from(fullLogoSvg))
    .png()
    .toFile('./public/examfriendly-logo.png');

  // 2. Generate pure badge logo (nav and standard)
  await sharp(Buffer.from(pureBadgeSvg))
    .png()
    .toFile('./public/examfriendly-nav.png');

  await sharp(Buffer.from(pureBadgeSvg))
    .png()
    .toFile('./public/logo.png');

  // Copy to dist if dist exists
  if (fs.existsSync('./dist')) {
    fs.copyFileSync('./public/examfriendly-logo.png', './dist/examfriendly-logo.png');
    fs.copyFileSync('./public/examfriendly-nav.png', './dist/examfriendly-nav.png');
    fs.copyFileSync('./public/logo.png', './dist/logo.png');
  }

  console.log('High-resolution PNG logos generated successfully!');
}

generateLogos();
