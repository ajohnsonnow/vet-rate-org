#!/usr/bin/env node
/**
 * ============================================================================
 * Vet-Rate Vision Model Fix Monitor
 * ============================================================================
 * 
 * This script monitors the MLC-AI GitHub issues to check if the vision model
 * WebGPU shader compatibility issue has been fixed.
 * 
 * Usage:
 *   node scripts/check-vision-model-fix.js
 * 
 * Or add to package.json scripts:
 *   "check-vision": "node scripts/check-vision-model-fix.js"
 * 
 * The script checks:
 *   1. Issue #727 (web-llm) - Vision models not working
 *   2. Issue #3394 (mlc-llm) - phi3V inference broken
 *   3. Latest web-llm releases for vision model updates
 * ============================================================================
 */

import https from 'https';

// Issues to monitor
const ISSUES_TO_CHECK = [
  {
    repo: 'mlc-ai/web-llm',
    issue: 727,
    title: 'Getting vision models to work — Phi 3.5, Gemma 3',
    keywords: ['fixed', 'resolved', 'merged', 'working', 'closed']
  },
  {
    repo: 'mlc-ai/mlc-llm',
    issue: 3394,
    title: 'phi3V (phi3.5v) inference is broken',
    keywords: ['fixed', 'resolved', 'merged', 'working', 'closed']
  }
];

// GitHub API helper
function fetchGitHub(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Vet-Rate-Vision-Monitor',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Check issue status
async function checkIssue(repo, issueNumber) {
  try {
    const { status, data } = await fetchGitHub(`/repos/${repo}/issues/${issueNumber}`);
    
    if (status !== 200) {
      return { error: `HTTP ${status}`, state: 'unknown' };
    }

    return {
      state: data.state,
      title: data.title,
      updated: data.updated_at,
      comments: data.comments,
      labels: data.labels?.map(l => l.name) || [],
      url: data.html_url
    };
  } catch (err) {
    return { error: err.message, state: 'unknown' };
  }
}

// Check recent comments for keywords
async function checkRecentComments(repo, issueNumber, keywords) {
  try {
    const { status, data } = await fetchGitHub(`/repos/${repo}/issues/${issueNumber}/comments?per_page=10&sort=created&direction=desc`);
    
    if (status !== 200 || !Array.isArray(data)) {
      return { hasPositiveSignal: false };
    }

    const recentComments = data.slice(0, 5);
    const positiveComments = recentComments.filter(comment => {
      const body = comment.body.toLowerCase();
      return keywords.some(kw => body.includes(kw.toLowerCase()));
    });

    return {
      hasPositiveSignal: positiveComments.length > 0,
      latestComment: recentComments[0]?.created_at,
      positiveComments: positiveComments.map(c => ({
        date: c.created_at,
        author: c.user.login,
        preview: c.body.substring(0, 100) + '...'
      }))
    };
  } catch (err) {
    return { hasPositiveSignal: false, error: err.message };
  }
}

// Check web-llm releases
async function checkLatestRelease() {
  try {
    const { status, data } = await fetchGitHub('/repos/mlc-ai/web-llm/releases?per_page=5');
    
    if (status !== 200 || !Array.isArray(data)) {
      return { error: 'Could not fetch releases' };
    }

    const latest = data[0];
    const visionMentions = data.filter(release => {
      const body = (release.body || '').toLowerCase();
      const name = (release.name || '').toLowerCase();
      return body.includes('vision') || body.includes('phi-3.5') || 
             name.includes('vision') || body.includes('vlm');
    });

    return {
      latest: {
        tag: latest.tag_name,
        name: latest.name,
        date: latest.published_at,
        url: latest.html_url
      },
      visionUpdates: visionMentions.length > 0,
      visionReleases: visionMentions.map(r => ({
        tag: r.tag_name,
        date: r.published_at
      }))
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Main function
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Vet-Rate Vision Model Fix Monitor                          ║');
  console.log('║     Checking MLC-AI GitHub for updates...                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  let hasFixSignal = false;

  // Check each issue
  for (const issue of ISSUES_TO_CHECK) {
    console.log(`📋 Checking ${issue.repo}#${issue.issue}...`);
    console.log(`   "${issue.title}"`);
    
    const status = await checkIssue(issue.repo, issue.issue);
    
    if (status.error) {
      console.log(`   ❌ Error: ${status.error}`);
      continue;
    }

    const stateIcon = status.state === 'closed' ? '✅' : '🔴';
    console.log(`   ${stateIcon} Status: ${status.state.toUpperCase()}`);
    console.log(`   📅 Last updated: ${new Date(status.updated).toLocaleDateString()}`);
    console.log(`   💬 Comments: ${status.comments}`);
    
    if (status.labels.length > 0) {
      console.log(`   🏷️  Labels: ${status.labels.join(', ')}`);
    }

    // Check recent comments
    const comments = await checkRecentComments(issue.repo, issue.issue, issue.keywords);
    
    if (comments.hasPositiveSignal) {
      console.log(`   🎉 POSITIVE SIGNAL DETECTED in recent comments!`);
      hasFixSignal = true;
      comments.positiveComments?.forEach(c => {
        console.log(`      - ${c.author} (${new Date(c.date).toLocaleDateString()}): ${c.preview}`);
      });
    }

    if (status.state === 'closed') {
      hasFixSignal = true;
    }

    console.log(`   🔗 ${status.url}`);
    console.log('');
  }

  // Check releases
  console.log('📦 Checking latest web-llm releases...');
  const releases = await checkLatestRelease();
  
  if (releases.error) {
    console.log(`   ❌ Error: ${releases.error}`);
  } else {
    console.log(`   Latest: ${releases.latest.tag} (${new Date(releases.latest.date).toLocaleDateString()})`);
    
    if (releases.visionUpdates) {
      console.log(`   🎉 VISION-RELATED RELEASES FOUND!`);
      hasFixSignal = true;
      releases.visionReleases?.forEach(r => {
        console.log(`      - ${r.tag} (${new Date(r.date).toLocaleDateString()})`);
      });
    } else {
      console.log(`   ℹ️  No vision-specific releases detected yet`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  if (hasFixSignal) {
    console.log('');
    console.log('🎉 POTENTIAL FIX DETECTED!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review the GitHub issues above for details');
    console.log('  2. Test with latest web-llm: npm update @mlc-ai/web-llm');
    console.log('  3. If working, run: ./scripts/build-vision-model.sh');
    console.log('  4. Update LocalAIPanel.jsx to enable the vision model');
    console.log('');
  } else {
    console.log('');
    console.log('⏳ No fix detected yet.');
    console.log('');
    console.log('The vision model issue is still being worked on upstream.');
    console.log('Re-run this script periodically to check for updates.');
    console.log('');
    console.log('Workarounds:');
    console.log('  • Use Chrome Canary with: --enable-dawn-features=allow_unsafe_apis');
    console.log('  • Use cloud AI (OpenAI/Claude) for image analysis');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // Exit with code based on fix status
  process.exit(hasFixSignal ? 0 : 1);
}

// Run
main().catch(err => {
  console.error('Monitor failed:', err);
  process.exit(1);
});
