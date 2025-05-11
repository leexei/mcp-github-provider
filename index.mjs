// MCP GitHub Context Provider - Node.js (ESM対応)
// ファイル名: index.mjs
// 必要パッケージ: express, @octokit/rest, js-base64, dotenv

import express from 'express';
import { Octokit } from '@octokit/rest';
import { decode as base64decode } from 'js-base64';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// MCP形式でGitHubリポジトリのREADMEとIssueを提供
app.get('/mcp/github/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const [readmeRes, issuesRes] = await Promise.all([
      octokit.repos.getReadme({ owner, repo }),
      octokit.issues.listForRepo({ owner, repo, state: 'open' })
    ]);

    const readme = base64decode(readmeRes.data.content);

    const context = {
      "@context": "https://openai.com/mcp/context",
      type: "github-repo",
      metadata: {
        title: `${owner}/${repo}`,
        description: readme.slice(0, 300) + (readme.length > 300 ? '...' : '')
      },
      entries: issuesRes.data.map(issue => ({
        type: "issue",
        id: issue.id,
        title: issue.title,
        body: issue.body?.slice(0, 1000) || ""
      }))
    };

    res.json(context);
  } catch (err) {
    console.error("GitHub APIエラー:", err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// MCP Manifest のサンプル提供
app.get('/mcp/github/:owner/:repo/manifest.json', (req, res) => {
  const { owner, repo } = req.params;
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  res.json({
    "@context": "https://openai.com/mcp/context-manifest",
    name: "GitHub MCP Provider",
    description: `Provides README and issues for ${owner}/${repo}`,
    version: "1.0",
    entries: [
      {
        uri: `mcp://github.com/${owner}/${repo}`,
        type: "github-repo",
        context_url: `${baseUrl}/mcp/github/${owner}/${repo}`
      }
    ]
  });
});

app.listen(port, () => {
  console.log(`MCP Context Provider running at http://localhost:${port}`);
});
