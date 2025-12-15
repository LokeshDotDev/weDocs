import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (optional - comment out if you want to preserve existing data)
  await prisma.requestLog.deleteMany({});
  await prisma.user.deleteMany({});

  // Hash passwords for demo users
  const hashedPassword = await bcrypt.hash('password123', 12);
  const hashedAdminPassword = await bcrypt.hash('admin123', 12);

  // Create demo users
  console.log('👥 Creating demo users...');
  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      username: 'admin',
      password: hashedAdminPassword,
      role: 'admin',
    },
  });

  const regularUser1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      username: 'john_doe',
      password: hashedPassword,
      role: 'user',
    },
  });

  const regularUser2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      username: 'jane_smith',
      password: hashedPassword,
      role: 'user',
    },
  });

  const regularUser3 = await prisma.user.create({
    data: {
      email: 'user3@example.com',
      username: 'bob_wilson',
      password: hashedPassword,
      role: 'user',
    },
  });

  console.log(`✅ Created ${4} demo users`);

  // Create sample request logs
  console.log('📝 Creating sample request logs...');

  const sampleLogs = [
    {
      requestId: uuidv4(),
      method: 'POST',
      url: '/api/users/login',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ip: '192.168.1.100',
      userId: adminUser.id,
      statusCode: 200,
      responseTime: 145,
      requestBody: { email: 'admin@example.com' },
      responseBody: { success: true, message: 'Login successful' },
      headers: { 'content-type': 'application/json' },
      query: {},
      params: {},
      createdAt: new Date('2024-01-15T10:30:00Z'),
    },
    {
      requestId: uuidv4(),
      method: 'GET',
      url: '/api/users/me',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ip: '192.168.1.101',
      userId: regularUser1.id,
      statusCode: 200,
      responseTime: 89,
      responseBody: { success: true, data: { user: { id: regularUser1.id, email: regularUser1.email } } },
      headers: { authorization: 'Bearer jwt-token-here' },
      query: {},
      params: {},
      createdAt: new Date('2024-01-15T11:15:00Z'),
    },
    {
      requestId: uuidv4(),
      method: 'POST',
      url: '/api/users/register',
      userAgent: 'PostmanRuntime/7.32.3',
      ip: '10.0.0.50',
      statusCode: 201,
      responseTime: 234,
      requestBody: { email: 'newuser@example.com', username: 'newuser', password: '[REDACTED]' },
      responseBody: { success: true, message: 'User created successfully' },
      headers: { 'content-type': 'application/json' },
      query: {},
      params: {},
      createdAt: new Date('2024-01-15T14:22:00Z'),
    },
    {
      requestId: uuidv4(),
      method: 'GET',
      url: '/api/users',
      userAgent: 'curl/7.68.0',
      ip: '192.168.1.102',
      userId: adminUser.id,
      statusCode: 200,
      responseTime: 167,
      responseBody: { success: true, data: { users: [], count: 4 } },
      headers: { authorization: 'Basic YWRtaW46YWRtaW4xMjM=' },
      query: { page: '1', limit: '10' },
      params: {},
      createdAt: new Date('2024-01-15T15:45:00Z'),
    },
    {
      requestId: uuidv4(),
      method: 'DELETE',
      url: '/api/users/invalid-id',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      ip: '192.168.1.103',
      userId: adminUser.id,
      statusCode: 404,
      responseTime: 45,
      responseBody: { success: false, error: { message: 'User not found' } },
      headers: { authorization: 'Basic YWRtaW46YWRtaW4xMjM=' },
      query: {},
      params: { id: 'invalid-id' },
      error: 'User with ID invalid-id not found',
      createdAt: new Date('2024-01-15T16:30:00Z'),
    },
    {
      requestId: uuidv4(),
      method: 'GET',
      url: '/api/health',
      userAgent: 'healthcheck/1.0',
      ip: '172.17.0.1',
      statusCode: 200,
      responseTime: 12,
      responseBody: { success: true, status: 'healthy', timestamp: new Date().toISOString() },
      headers: {},
      query: {},
      params: {},
      createdAt: new Date('2024-01-15T17:00:00Z'),
    },
    {
      requestId: uuidv4(),
      method: 'POST',
      url: '/api/users/login',
      userAgent: 'axios/1.6.0',
      ip: '192.168.1.104',
      statusCode: 401,
      responseTime: 98,
      requestBody: { email: 'wrong@example.com', password: '[REDACTED]' },
      responseBody: { success: false, error: { message: 'Invalid credentials' } },
      headers: { 'content-type': 'application/json' },
      query: {},
      params: {},
      error: 'Authentication failed: Invalid email or password',
      createdAt: new Date('2024-01-15T18:15:00Z'),
    },
  ];

  // Create request logs in batch
  await prisma.requestLog.createMany({
    data: sampleLogs,
  });

  console.log(`✅ Created ${sampleLogs.length} sample request logs`);

  // Display summary
  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`👥 Users created: 4 (1 admin, 3 regular users)`);
  console.log(`📝 Request logs created: ${sampleLogs.length}`);
  
  console.log('\n🔑 Demo Login Credentials:');
  console.log('Admin User:');
  console.log('  Email: admin@example.com');
  console.log('  Password: admin123');
  console.log('Regular Users:');
  console.log('  Email: user1@example.com, Password: password123');
  console.log('  Email: user2@example.com, Password: password123');
  console.log('  Email: user3@example.com, Password: password123');

  console.log('\n📈 Sample API calls you can make:');
  console.log('POST /api/users/login - Login with demo credentials');
  console.log('GET /api/users/me - Get current user info (JWT required)');
  console.log('GET /api/users - Get all users (admin auth required)');
  console.log('GET /api/health - Health check');
  console.log('GET /api/logs - View request logs (basic auth required)');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
