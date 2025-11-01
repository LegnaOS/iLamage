#!/usr/bin/env node

/**
 * Download ffmpeg static binaries for all platforms
 * 
 * This script downloads ffmpeg binaries from official sources:
 * - macOS: evermeet.cx (Intel x64)
 * - Windows: gyan.dev (x64 and x86)
 * - Linux: johnvansickle.com (x64)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '../public/bin');

// FFmpeg download URLs
const FFMPEG_URLS = {
  mac: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
  win64: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
  win32: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', // Same as win64, will extract 32-bit if available
  linux: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
};

const PLATFORM_DIRS = {
  mac: path.join(binDir, 'mac'),
  win64: path.join(binDir, 'win64'),
  win32: path.join(binDir, 'win32'),
  linux: path.join(binDir, 'linux')
};

console.log('🚀 FFmpeg Binary Downloader');
console.log('============================\n');

/**
 * Download file from URL
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    
    console.log(`📥 Downloading: ${url}`);
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }
      
      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n✅ Download complete\n');
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

/**
 * Extract archive
 */
function extractArchive(archivePath, destDir, platform) {
  console.log(`📦 Extracting to: ${destDir}`);
  
  try {
    if (archivePath.endsWith('.zip')) {
      // Use unzip for macOS/Linux, or 7z for Windows
      if (process.platform === 'win32') {
        execSync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`unzip -q -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
      }
    } else if (archivePath.endsWith('.tar.xz')) {
      execSync(`tar -xJf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
    }
    
    console.log('✅ Extraction complete\n');
    
    // Find and move ffmpeg binary to platform directory
    moveBinaryToRoot(destDir, platform);
    
  } catch (err) {
    console.error('❌ Extraction failed:', err.message);
    throw err;
  }
}

/**
 * Find ffmpeg binary in extracted directory and move to platform root
 */
function moveBinaryToRoot(destDir, platform) {
  console.log(`🔍 Looking for ffmpeg binary in ${destDir}`);
  
  const binaryName = platform.startsWith('win') ? 'ffmpeg.exe' : 'ffmpeg';
  let ffmpegPath = null;
  
  // Recursively search for ffmpeg binary
  function findBinary(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const result = findBinary(fullPath);
        if (result) return result;
      } else if (file === binaryName) {
        return fullPath;
      }
    }
    return null;
  }
  
  ffmpegPath = findBinary(destDir);
  
  if (!ffmpegPath) {
    throw new Error(`Could not find ${binaryName} in extracted files`);
  }
  
  console.log(`✅ Found: ${ffmpegPath}`);
  
  // Move to platform directory root
  const targetPath = path.join(PLATFORM_DIRS[platform], binaryName);
  fs.copyFileSync(ffmpegPath, targetPath);
  
  // Make executable on Unix systems
  if (!platform.startsWith('win')) {
    fs.chmodSync(targetPath, 0o755);
  }
  
  console.log(`✅ Moved to: ${targetPath}\n`);
  
  // Clean up extracted directory
  fs.rmSync(destDir, { recursive: true, force: true });
}

/**
 * Download and install ffmpeg for a platform
 */
async function installFFmpeg(platform) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📦 Installing FFmpeg for ${platform}`);
  console.log(`${'='.repeat(50)}\n`);
  
  const url = FFMPEG_URLS[platform];
  const platformDir = PLATFORM_DIRS[platform];
  
  // Ensure platform directory exists
  if (!fs.existsSync(platformDir)) {
    fs.mkdirSync(platformDir, { recursive: true });
  }
  
  // Determine archive extension
  const ext = url.includes('.zip') ? '.zip' : '.tar.xz';
  const archivePath = path.join(platformDir, `ffmpeg-download${ext}`);
  const extractDir = path.join(platformDir, 'ffmpeg-extract');
  
  try {
    // Download
    await downloadFile(url, archivePath);
    
    // Extract
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    extractArchive(archivePath, extractDir, platform);
    
    // Clean up archive
    fs.unlinkSync(archivePath);
    
    console.log(`✅ ${platform} installation complete!\n`);
    
  } catch (err) {
    console.error(`❌ Failed to install ffmpeg for ${platform}:`, err.message);
    throw err;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const platforms = args.length > 0 ? args : ['mac', 'win64', 'win32', 'linux'];
  
  console.log(`Platforms to install: ${platforms.join(', ')}\n`);
  
  for (const platform of platforms) {
    if (!FFMPEG_URLS[platform]) {
      console.error(`❌ Unknown platform: ${platform}`);
      continue;
    }
    
    try {
      await installFFmpeg(platform);
    } catch (err) {
      console.error(`❌ Installation failed for ${platform}`);
      // Continue with other platforms
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 FFmpeg installation complete!');
  console.log('='.repeat(50));
}

// Run
main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

