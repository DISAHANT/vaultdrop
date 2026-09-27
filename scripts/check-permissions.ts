import fs from 'fs';
import path from 'path';

// Load .env
const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function check() {
  const { generateAppJwt } = await import('../src/lib/github/app');
  const jwt = generateAppJwt();
  const res = await fetch('https://api.github.com/app', {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VaultDrop',
    },
  });
  const data = await res.json();
  console.log('App Name:', data.name);
  console.log('App Permissions:', JSON.stringify(data.permissions, null, 2));

  const prisma = (await import('../src/lib/db')).default;
  const connection = await prisma.gitHubConnection.findFirst();
  if (connection && connection.githubInstallationId) {
    const { getInstallationAccessToken } = await import('../src/lib/github/app');
    const token = await getInstallationAccessToken(connection.githubInstallationId);
    const repoRes = await fetch('https://api.github.com/installation/repositories', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'VaultDrop',
      },
    });
    const repoData = await repoRes.json();
    console.log('\nAccessible Repos Count:', repoData.total_count);
    console.log('Accessible Repos:', (repoData.repositories || []).map((r: any) => r.full_name));
  }
}

check().catch(console.error);
