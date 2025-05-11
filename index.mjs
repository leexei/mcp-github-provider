// MCP GitHub Context Provider - Node.js (ESM対応) for leexei/lex-blog with code file injection (app/page.tsx)
import express from 'express';
import { Octokit } from '@octokit/rest';
import { decode as base64decode } from 'js-base64';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// MCP形式でGitHubリポジトリのREADME, Issues, コードファイルを提供
app.get('/mcp/github/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;

  // 対象リポジトリを leexei/lex-blog に限定
  if (owner !== 'leexei' || repo !== 'lex-blog') {
    return res.status(403).json({ error: 'Unauthorized repository access' });
  }

  try {
    const [readmeRes, issuesRes, codeRes] = await Promise.all([
      octokit.repos.getReadme({ owner, repo }),
      octokit.issues.listForRepo({ owner, repo, state: 'open' }),
      octokit.repos.getContent({ owner, repo, path: 'app/page.tsx' })
    ]);

    const readme = base64decode(readmeRes.data.content);

    let codeEntry = null;
    if (codeRes && Array.isArray(codeRes.data) === false && codeRes.data.content) {
      const codeText = base64decode(codeRes.data.content);
      codeEntry = {
        type: "code",
        filename: "app/page.tsx",
        language: "typescript",
        content: codeText.slice(0, 2000) + (codeText.length > 2000 ? "\n// (truncated)" : "")
      };
    }

    const issueEntries = issuesRes.data.map(issue => ({
      type: "issue",
      id: issue.id,
      title: issue.title,
      body: issue.body?.slice(0, 1000) || ""
    }));

    const entries = codeEntry ? [codeEntry, ...issueEntries] : issueEntries;

    res.json({
      "@context": "https://openai.com/mcp/context",
      type: "github-repo",
      metadata: {
        title: `${owner}/${repo}`,
        description: readme.slice(0, 300) + (readme.length > 300 ? '...' : '')
      },
      entries
    });
  } catch (err) {
    console.error("GitHub APIエラー:", err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// MCP Manifest の提供（leexei/lex-blog専用）
app.get('/mcp/github/:owner/:repo/manifest.json', (req, res) => {
  const { owner, repo } = req.params;
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  if (owner !== 'leexei' || repo !== 'lex-blog') {
    return res.status(403).json({ error: 'Unauthorized repository access' });
  }

  res.json({
    "@context": "https://openai.com/mcp/context-manifest",
    name: "Private Repo Context Provider",
    description: `Provides context for leexei/lex-blog`,
    version: "1.0",
    entries: [
      {
        uri: `mcp://github.com/leexei/lex-blog`,
        type: "github-repo",
        context_url: `${baseUrl}/mcp/github/leexei/lex-blog`
      }
    ]
  });
});

app.listen(port, () => {
  console.log(`MCP Context Provider running at http://localhost:${port}`);
});