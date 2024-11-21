const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const router = express.Router();

const app = express();
const PORT = 3000;
const ENCRYPTION_KEY = 'R&D'; // Encryption key used for both encryption and decryption

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection setup
const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'app_user',
  password: '123',
  database: 'reservation_delivery_system'
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to MySQL database.');
});


// Route for handling signup
app.post('/signup', (req, res) => {
	
	console.log("singup");
    const { username, email, password } = req.body;

    // Query to insert new user with AES encryption for password
    const query = `
        INSERT INTO users (username, password, role, email)
        VALUES (?, AES_ENCRYPT(?, ?), 'CUSTOMER', ?)
    `;

    db.query(query, [username, password, ENCRYPTION_KEY, email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
            return;
        }

        res.json({ success: true, message: 'Signup successful. Please log in.' });
    });
});

// Route for handling login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  console.log(password);

  // Query to retrieve and decrypt password from DB
  const query = `
    SELECT id, username, email, role
    FROM users 
    WHERE username = ? 
      AND AES_DECRYPT(password, ?) = ?
  `;

  db.query(query, [username, ENCRYPTION_KEY, password], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }

    if (results.length > 0) {
      // Send back the user's id, username, email, and role
      res.json({ 
        success: true, 
        message: 'Login successful',
        userId: results[0].id,
        username: results[0].username,
        email: results[0].email,
        role: results[0].role
      });
    } else {
      res.json({ success: false, message: 'Invalid username or password' });
    }
  });
});


// Endpoint to get all restaurants
app.get('/api/restaurants', (req, res) => {
    const query = 'SELECT res_id, res_name FROM restaurant';
	
	console.log("to query restaurants")
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Endpoint to get menu items for a specific restaurant
app.get('/api/menu/:res_id', (req, res) => {
    const res_id = req.params.res_id;
    const query = `
        SELECT i.item_name, i.price, i.item_id
        FROM menu m
        JOIN items i ON m.item_id = i.item_id
        WHERE m.menu_id IN (SELECT menu_id FROM restaurant WHERE res_id = ?)
    `;
	
	
	console.log("fetching items for " + res_id);
	
    db.query(query, [res_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
		
		console.log(results);
		
        // Convert price to a number
        const menuItems = results.map(item => ({
            item_name: item.item_name,
            price: parseFloat(item.price), // Ensure price is a number
			item_id: item.item_id
        }));

        res.json(menuItems);
    });
});

app.get('/api/payment-options', (req, res) => {
    const query = 'SELECT paytype_id, paytype_name FROM payment';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching payment options:', err);
            res.status(500).send('Error fetching payment options');
        } else {
            res.json(results);
        }
    });
});

// API endpoint to get restaurant details
app.get('/api/restaurant', (req, res) => {
    const query = 'SELECT * FROM restaurant';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// API endpoint to get menu items
app.get('/api/menu', (req, res) => {
    const query = 'SELECT * FROM items';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// API endpoint to get table details
app.get('/api/tables', (req, res) => {
    const query = 'SELECT * FROM tables';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to update restaurant details
app.put('/api/restaurant/:res_id', (req, res) => {
    const resId = req.params.res_id;
    const { res_name, menu_id } = req.body;

    const query = `
        UPDATE restaurant 
        SET res_name = ?, menu_id = ?
        WHERE res_id = ?
    `;

    db.query(query, [res_name, menu_id, resId], (err, results) => {
        if (err) {
            console.error('Error updating restaurant:', err);
            return res.status(500).json({ success: false, message: 'Failed to update restaurant' });
        }
        res.json({ success: true, message: 'Restaurant updated successfully' });
    });
});

// Endpoint to create a new order
app.post('/api/orders', (req, res) => {
	
	console.log("inserting into orders:" + req);
    const { items, user_id, order_value, payment_id, res_id, address, contact } = req.body;

    // SQL query to insert order details into orders table
    const orderQuery = `
        INSERT INTO orders (user_id, order_value, payment_id, res_id, address, contact)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    // Execute the main order insertion query
    db.query(orderQuery, [user_id, order_value, payment_id, res_id, address, contact], (err, result) => {
        if (err) {
            console.error('Error inserting order:', err);
            return res.status(500).json({ success: false, message: 'Failed to create order' });
        }

        const order_id = result.insertId;

        // Insert each item in the cart into an order_items table (assuming order_items table exists)
        const itemInsertPromises = items.map(item => {
            const itemQuery = `
                INSERT INTO order_items (order_id, item_id, quantity)
                VALUES (?, ?, ?)
            `;
            return new Promise((resolve, reject) => {
                db.query(itemQuery, [order_id, item.item_id, item.quantity], (err, itemResult) => {
                    if (err) {
                        console.error('Error inserting item:', err);
                        reject(err);
                    } else {
                        resolve(itemResult);
                    }
                });
            });
        });

        // Execute all item insertion queries
        Promise.all(itemInsertPromises)
            .then(() => {
                res.json({ success: true, message: 'Order created successfully', order_id });
            })
            .catch(err => {
                console.error('Error inserting items:', err);
                res.status(500).json({ success: false, message: 'Failed to insert order items' });
            });
    });
});

// Endpoint to check table availability based on restaurant and seat request
app.get('/api/check-availability', (req, res) => {

    console.log("Checking availability...");
    const { res_id, seats_requested } = req.query;

    // Validate inputs
    if (!res_id || !seats_requested) {
        return res.status(400).json({ success: false, message: 'res_id and seats_requested are required' });
    }

    // Query to fetch available tables for the requested restaurant and seat count
    const query = `
        SELECT table_id, table_name, seating_capacity, booking_status
        FROM tables
        WHERE res_id = ? AND seating_capacity >= ? AND booking_status = 'AVAILABLE'
        ORDER BY seating_capacity ASC
    `;

    db.query(query, [res_id, seats_requested], (err, results) => {
        if (err) {
            console.error('Error checking table availability:', err);
            return res.status(500).json({ success: false, message: 'Failed to check table availability' });
        }

        console.log("Available tables found:", JSON.stringify(results));

        // If no available tables found
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No available tables for the requested number of seats' });
        }

        // Return available tables with relevant details
        res.json({
            success: true,
            message: 'Available tables fetched successfully',
            tables: results.map(table => ({
                table_id: table.table_id,
                table_name: table.table_name,
                seating_capacity: table.seating_capacity,
                booking_status: table.booking_status
            }))
        });
    });
});


app.post('/api/make-reservation', (req, res) => {
    const { user_id, table_id, seats_requested } = req.body;
	console.log("making reservation:"+ req.body)
    // Validate inputs
    if (!user_id || !table_id || !seats_requested) {
        return res.status(400).json({ success: false, message: 'user_id, table_id, and seats_requested are required' });
    }

    // Step 1: Update the table booking_status to 'BOOKED'
    const updateQuery = `
        UPDATE tables
        SET booking_status = 'BOOKED'
        WHERE table_id = ? AND booking_status != 'BOOKED'
    `;

    db.query(updateQuery, [table_id], (err, updateResults) => {
        if (err) {
            console.error('Error updating table status:', err);
            return res.status(500).json({ success: false, message: 'Failed to update table status' });
        }

        if (updateResults.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'Table is already booked or not available' });
        }

        // Step 2: Insert a new booking record into the bookings table
        const insertQuery = `
            INSERT INTO reservations (user_id, table_id, seats_requested, booking_date)
            VALUES (?, ?, ?, NOW())
        `;

        db.query(insertQuery, [user_id, table_id, seats_requested], (err, results) => {
            if (err) {
                console.error('Error making reservation:', err);
                return res.status(500).json({ success: false, message: 'Failed to make reservation' });
            }

            // Return the booking ID and success message
            res.json({ success: true, message: 'Reservation successful', booking_id: results.insertId });
        });
    });
});



app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
