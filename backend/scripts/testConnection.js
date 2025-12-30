const { testConnections } = require('../config/database');

testConnections().then(success => {
  if (success) {
    console.log('\n✅ All database connections successful!');
    process.exit(0);
  } else {
    console.log('\n❌ Database connection failed!');
    process.exit(1);
  }
});

