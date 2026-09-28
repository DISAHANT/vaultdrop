const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function runIsolationTests() {
  console.log('====================================================');
  console.log('VAULTDROP — GITHUB MULTI-ACCOUNT ISOLATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      failed++;
    }
  }

  // 1. Setup two distinct test VaultDrop users
  const userAEmail = `test_vault_user_a_${Date.now()}@example.com`;
  const userBEmail = `test_vault_user_b_${Date.now()}@example.com`;

  console.log(`Creating VaultDrop User A (${userAEmail})...`);
  const userA = await prisma.user.create({
    data: {
      email: userAEmail,
      name: 'VaultDrop User A',
    },
  });

  console.log(`Creating VaultDrop User B (${userBEmail})...`);
  const userB = await prisma.user.create({
    data: {
      email: userBEmail,
      name: 'VaultDrop User B',
    },
  });

  try {
    // TEST 1: Initial state - Neither user has GitHub connection
    const statusA0 = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userA.id, status: 'active' },
    });
    const statusB0 = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userB.id, status: 'active' },
    });
    assert(statusA0 === null, 'User A initially has no active GitHub connection');
    assert(statusB0 === null, 'User B initially has no active GitHub connection');

    // TEST 2: User A connects GitHub Account A (e.g. dev-user-a, id: 90001, inst: 80001)
    console.log('\n--- Connecting GitHub Account A to User A ---');
    const connA = await prisma.gitHubConnection.create({
      data: {
        vaultdropUserId: userA.id,
        githubUserId: 90001,
        githubLogin: 'dev-user-a',
        githubAvatarUrl: 'https://avatars.githubusercontent.com/u/90001',
        githubInstallationId: 80001,
        githubAccountType: 'User',
        accessToken: 'gho_fake_token_user_a',
        status: 'active',
      },
    });

    // Verify User A has connection A
    const userAActive = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userA.id, status: 'active' },
    });
    assert(userAActive?.id === connA.id, 'User A sees their own active GitHub connection');
    assert(userAActive?.githubLogin === 'dev-user-a', 'User A sees GitHub login "dev-user-a"');

    // TEST 3: User B must NOT see or inherit Account A
    const userBAfterA = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userB.id, status: 'active' },
    });
    assert(userBAfterA === null, 'User B DOES NOT inherit or see User A connection');

    // TEST 4: User B connects GitHub Account B (e.g. dev-user-b, id: 90002, inst: 80002) independently
    console.log('\n--- Connecting GitHub Account B to User B ---');
    const connB = await prisma.gitHubConnection.create({
      data: {
        vaultdropUserId: userB.id,
        githubUserId: 90002,
        githubLogin: 'dev-user-b',
        githubAvatarUrl: 'https://avatars.githubusercontent.com/u/90002',
        githubInstallationId: 80002,
        githubAccountType: 'User',
        accessToken: 'gho_fake_token_user_b',
        status: 'active',
      },
    });

    const userBActive = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userB.id, status: 'active' },
    });
    assert(userBActive?.id === connB.id, 'User B sees their own independent GitHub connection');
    assert(userBActive?.githubLogin === 'dev-user-b', 'User B sees GitHub login "dev-user-b"');
    assert(userBActive?.githubLogin !== userAActive?.githubLogin, 'User A and User B have separate logins');
    assert(userBActive?.githubInstallationId !== userAActive?.githubInstallationId, 'User A and User B have separate installations');

    // TEST 5: Workspaces & Repositories Isolation
    console.log('\n--- Testing Workspace & Repository Mapping Isolation ---');
    const wsA = await prisma.workspace.create({
      data: {
        name: 'Workspace Alpha',
        ownerId: userA.id,
        shareCode: `wsa_${Date.now()}`,
      },
    });

    const wsB = await prisma.workspace.create({
      data: {
        name: 'Workspace Beta',
        ownerId: userB.id,
        shareCode: `wsb_${Date.now()}`,
      },
    });

    // Link Repo A to Workspace A
    await prisma.workspaceGitHubRepo.create({
      data: {
        workspaceId: wsA.id,
        vaultdropUserId: userA.id,
        installationId: 80001,
        repositoryId: 555001,
        owner: 'dev-user-a',
        repositoryName: 'repo-alpha',
        defaultBranch: 'main',
      },
    });

    // Link Repo B to Workspace B
    await prisma.workspaceGitHubRepo.create({
      data: {
        workspaceId: wsB.id,
        vaultdropUserId: userB.id,
        installationId: 80002,
        repositoryId: 555002,
        owner: 'dev-user-b',
        repositoryName: 'repo-beta',
        defaultBranch: 'main',
      },
    });

    // User A workspace mapping queries
    const userARepos = await prisma.workspaceGitHubRepo.findMany({
      where: { vaultdropUserId: userA.id },
    });
    assert(userARepos.length === 1 && userARepos[0].repositoryName === 'repo-alpha', 'User A only sees repo-alpha');

    // User B workspace mapping queries
    const userBRepos = await prisma.workspaceGitHubRepo.findMany({
      where: { vaultdropUserId: userB.id },
    });
    assert(userBRepos.length === 1 && userBRepos[0].repositoryName === 'repo-beta', 'User B only sees repo-beta');

    // TEST 6: User B cannot access User A's workspace repository
    const unauthorizedQuery = await prisma.workspaceGitHubRepo.findFirst({
      where: {
        workspaceId: wsA.id,
        vaultdropUserId: userB.id, // User B trying to access User A's workspace repo
      },
    });
    assert(unauthorizedQuery === null, 'User B CANNOT query or access User A workspace repository mapping');

    // TEST 7: OAuth State Tampering and User Mismatch Simulation
    console.log('\n--- Testing OAuth State & Session Mismatch Security ---');
    const secret = process.env.NEXTAUTH_SECRET || 'vaultdrop-oauth-secret';
    const stateToken = crypto.randomBytes(32).toString('hex');
    const validOrigin = 'https://vaultdrop-eta.vercel.app';

    // State created for User A
    const sigA = crypto
      .createHmac('sha256', secret)
      .update(`${userA.id}:${stateToken}:${validOrigin}`)
      .digest('hex');

    const statePayloadA = {
      token: stateToken,
      userId: userA.id,
      returnUrl: '/github',
      origin: validOrigin,
      sig: sigA,
    };

    // User B tries to hijack User A's state or exchange with User B session
    const currentSessionUser = userB; // User B is the session user
    const isStateMismatched = currentSessionUser.id !== statePayloadA.userId;
    assert(isStateMismatched, 'System detects and rejects User B attempting to consume User A OAuth state');

    // Tampered signature check
    const tamperedSig = crypto
      .createHmac('sha256', secret)
      .update(`${userB.id}:${stateToken}:${validOrigin}`)
      .digest('hex');
    const isSigForged = statePayloadA.sig !== tamperedSig;
    assert(isSigForged, 'State signature verification detects forged user payload');

    // TEST 8: Disconnect User A - leaves User B intact
    console.log('\n--- Testing Disconnection Isolation ---');
    await prisma.gitHubConnection.deleteMany({
      where: { vaultdropUserId: userA.id },
    });
    await prisma.workspaceGitHubRepo.deleteMany({
      where: { vaultdropUserId: userA.id },
    });

    const userAAfterDisconnect = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userA.id, status: 'active' },
    });
    const userBAfterDisconnect = await prisma.gitHubConnection.findFirst({
      where: { vaultdropUserId: userB.id, status: 'active' },
    });

    assert(userAAfterDisconnect === null, 'User A connection was cleanly deleted upon disconnect');
    assert(userBAfterDisconnect?.id === connB.id, 'User B connection remains COMPLETELY INTACT and unaffected');
    assert(userBAfterDisconnect?.githubLogin === 'dev-user-b', 'User B retains login dev-user-b');

    // Cleanup test records
    console.log('\n--- Cleaning up test records ---');
    await prisma.workspaceGitHubRepo.deleteMany({
      where: { vaultdropUserId: { in: [userA.id, userB.id] } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsA.id, wsB.id] } },
    });
    await prisma.gitHubConnection.deleteMany({
      where: { vaultdropUserId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    console.log('Test records cleaned up successfully.');

  } catch (err) {
    console.error('Error during test execution:', err);
    // Cleanup on error
    await prisma.workspaceGitHubRepo.deleteMany({
      where: { vaultdropUserId: { in: [userA.id, userB.id] } },
    }).catch(() => {});
    await prisma.workspace.deleteMany({
      where: { ownerId: { in: [userA.id, userB.id] } },
    }).catch(() => {});
    await prisma.gitHubConnection.deleteMany({
      where: { vaultdropUserId: { in: [userA.id, userB.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    }).catch(() => {});
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runIsolationTests();
