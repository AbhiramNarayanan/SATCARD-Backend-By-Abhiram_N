const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const bodyParser = require("body-parser");
const amqp = require("amqplib");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const cors =require("cors")

const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON data
app.use(bodyParser.json());
app.use(cors());


mongoose.connect('mongodb+srv://abhiramsatcardproject:Abhiramsatcardproject2024@satcardprojectbyabhiram.eyg3frs.mongodb.net/Abhiramsatcardprojectcollection?retryWrites=true&w=majority');
const db = mongoose.connection;

// Handled MongoDB connection events
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});



// Defined a MongoDB schema for data
const accelerometerSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  z: Number,
},{timestamps: true,});

const Accelerometer = mongoose.model('Accelerometer', accelerometerSchema);



// Accumulator for incoming accelerometer data
let accumulatedData = [];

// Middleware for data processing and cleaning
app.use('/process-data', async (req, res, next) => {
  try {

    

    // Accumulate incoming data
    accumulatedData.push(req.body);
    

    // Process data when a certain number of entries are accumulated (e.g., every 3 entries)
    if (accumulatedData.length >= 3) {
      
      // Process accelerometer data (calculate averages)
      const processedData = processAccelerometerData(accumulatedData);

      // Clean processed data (remove outliers)
      const cleanedData = removeOutliers(processedData);

      // Created a new Accelerometer document with processed and cleaned data
      const accelerometerData = new Accelerometer(cleanedData);
      await accelerometerData.save();

      console.log('Processed and cleaned data saved to MongoDB:', accelerometerData);

      // Reset accumulated data
      accumulatedData = [];
    }

    res.status(200).send('Data processed and saved successfully');
  } catch (error) {
    console.error('Error processing and saving data to MongoDB:', error);
    res.status(500).send('Internal Server Error');
  }
});




function processAccelerometerData(data) {
  if (!Array.isArray(data)) {
    // If data is not an array, return the original data
    return data;
  }

  const count = data.length;

  if (count === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  // Calculate averages for x, y, and z
  const sum = data.reduce((acc, d) => {
    acc.x += d.x;
    acc.y += d.y;
    acc.z += d.z;
    return acc;
  }, { x: 0, y: 0, z: 0 });

  const averages = {
    x: sum.x / count,
    y: sum.y / count,
    z: sum.z / count,
  };

  return averages;
}



function removeOutliers(data) {
  

  const cleanedData = {
    x: clamp(data.x, 1, 9),
    y: clamp(data.y, 1, 9),
    z: clamp(data.z, 1, 9),
  };

  return cleanedData;
}

// Helper function to clamp a value within a specified range
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}



// Defined a route for analytics data retrieval
app.get('/analytics-data', async (req, res) => {
  try {
    // Fetch processed data from MongoDB 
    const analyticsData = await Accelerometer.find().lean();

    res.status(200).json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  console.log("A user connected");

  // Emulate data from sensors (need to replace this with actual sensor data now I am creating a dynamic data randomly)
  setInterval(() => {
    const accelerometerData = {
      x: Math.random() * 10,
      y: Math.random() * 10,
      z: Math.random() * 10,
    };

    // Send data to the server for processing
    sendDataToServer(accelerometerData);
    socket.emit("accelerometer", accelerometerData);
  }, 1000);

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


async function sendDataToServer(data) {
  try {

    
    // Connect to RabbitMQ
    const connection = await amqp.connect("amqps://zdyswmsp:Ojf5yWTqWnMe78taXDn8QusPGgkSOJxN@lionfish.rmq.cloudamqp.com/zdyswmsp");
    const channel = await connection.createChannel();

    // Declare a queue
    const queue = "dataQueue";
    await channel.assertQueue(queue, { durable: false });

    // Send data to the queue
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
    console.log("Data sent to the queue:", data);

    // Close the connection
    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error("Error sending data to the queue:", error);
  }
}
