const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins (update for production)
    methods: ["GET", "POST"]
  }
});

// Store orders
let orders = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join a specific room (customer or kitchen)
  socket.on('join', (role) => {
    socket.join(role);
    console.log(`${socket.id} joined as ${role}`);

    // Send current orders to kitchen when they connect
    if (role === 'kitchen') {
      socket.emit('current_orders', orders);
    }
  });

  // Handle new orders from customers
  socket.on('new_order', (order) => {
    const orderId = Date.now().toString();
    orders[orderId] = {
      ...order,
      id: orderId,
      status: 'new',
      timestamp: new Date()
    };

    // Broadcast to all kitchen clients
    io.to('kitchen').emit('order_received', orders[orderId]);
  });

  // Handle status updates from kitchen
  socket.on('update_status', ({ orderId, status }) => {
    if (orders[orderId]) {
      orders[orderId].status = status;

      // Notify the customer who placed this order
      io.to(`customer_${orders[orderId].tableId}`).emit('status_update', {
        orderId,
        status
      });

      // Update all kitchen clients
      io.to('kitchen').emit('order_updated', orders[orderId]);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});