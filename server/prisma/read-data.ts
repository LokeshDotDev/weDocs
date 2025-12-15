import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function readData() {
  console.log('📚 Reading data from database...\n');

  try {
    // Read all users
    console.log('👥 USERS:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (users.length === 0) {
      console.log('  No users found. Run `npm run db:seed` to populate data.');
    } else {
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.email})`);
        console.log(`     Role: ${user.role}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Created: ${user.createdAt.toISOString()}`);
        console.log('');
      });
    }

    console.log(`📊 Total users: ${users.length}\n`);

    // Read request logs with user information
    console.log('📝 REQUEST LOGS (Latest 10):');
    const logs = await prisma.requestLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    if (logs.length === 0) {
      console.log('  No request logs found. Run `npm run db:seed` to populate data.');
    } else {
      logs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.method} ${log.url}`);
        console.log(`     Status: ${log.statusCode} (${log.responseTime}ms)`);
        console.log(`     IP: ${log.ip || 'N/A'}`);
        console.log(`     User ID: ${log.userId || 'Anonymous'}`);
        console.log(`     Request ID: ${log.requestId}`);
        console.log(`     Time: ${log.createdAt.toISOString()}`);
        if (log.error) {
          console.log(`     Error: ${log.error}`);
        }
        console.log('');
      });
    }

    console.log(`📊 Total request logs: ${await prisma.requestLog.count()}\n`);

    // Statistics
    console.log('📈 STATISTICS:');
    
    // User stats
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const userCount = await prisma.user.count({ where: { role: 'user' } });
    
    console.log(`  👑 Admin users: ${adminCount}`);
    console.log(`  👤 Regular users: ${userCount}`);

    // Request log stats
    const statusStats = await prisma.$queryRaw`
      SELECT "statusCode", COUNT(*)::int as count
      FROM "request_logs"
      GROUP BY "statusCode"
      ORDER BY "statusCode"
    ` as Array<{ statusCode: number; count: number }>;

    console.log('  📊 HTTP Status Code Distribution:');
    statusStats.forEach(stat => {
      const statusText = getStatusText(stat.statusCode);
      console.log(`     ${stat.statusCode} ${statusText}: ${stat.count} requests`);
    });

    // Method stats
    const methodStats = await prisma.$queryRaw`
      SELECT method, COUNT(*)::int as count
      FROM "request_logs"
      GROUP BY method
      ORDER BY count DESC
    ` as Array<{ method: string; count: number }>;

    console.log('  🔄 HTTP Method Distribution:');
    methodStats.forEach(stat => {
      console.log(`     ${stat.method}: ${stat.count} requests`);
    });

    // Recent activity
    const recentActivity = await prisma.requestLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    console.log(`  🕐 Recent activity (last 24h): ${recentActivity} requests`);

  } catch (error) {
    console.error('❌ Error reading data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  };
  return statusTexts[code] || 'Unknown';
}

// Run if this file is executed directly
if (require.main === module) {
  readData()
    .then(() => {
      console.log('\n✅ Data reading completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { readData };
