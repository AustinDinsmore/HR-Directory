const pg = require("pg");
const express = require("express");

const client = new pg.Client(
    process.env.DATABASE_URL || "postgress://localhost/hr_directory_db"
);
const server = express();

const init = async () => {
    await client.connect();
    console.log("Client connected");

    //Wipe database and create new table based on our schema
    let SQL = `
        DROP TABLE IF EXISTS employee;
        DROP TABLE IF EXISTS department;

        CREATE TABLE department(
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL
        );

        CREATE TABLE employee(
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            department_id INTEGER REFERENCES department(id) NOT NULL
        );`;
    //waiting for database to process query
    await client.query(SQL);
    console.log("tables created");

    //inserting data into table
    SQL = `INSERT INTO department(name) VALUES('IB');
    INSERT INTO department(name) VALUES('OB');
    INSERT INTO department(name) VALUES('NI');

    INSERT INTO employee(name, department_id) VALUES('Leo', (SELECT id FROM department WHERE name='IB'));
    INSERT INTO employee(name, department_id) VALUES('Luna', (SELECT id FROM department WHERE name='IB'));
    INSERT INTO employee(name, department_id) VALUES('Diamond', (SELECT id FROM department WHERE name='OB'));
    INSERT INTO employee(name, department_id) VALUES('Caleb', (SELECT id FROM department WHERE name='OB'));
    INSERT INTO employee(name, department_id) VALUES('Jesus', (SELECT id FROM department WHERE name='NI'));`;

    await client.query(SQL);
    console.log("data seeded");

    //Server listening on a port
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => console.log(`listening on port ${PORT}`));
};

//call function to start the server
init ();

//middleware to use before all routes
server.use(express.json()); //parses the request body so our route can access it
server.use(require("morgan")("dev")); //logs the requests received to the server

//Routes. Returns an array of department objects
server.get("/api/department", async (req, res, next) => {
    try {
      const SQL = `
        SELECT * from department;
      `;
      const response = await client.query(SQL);
      //send the response. If no status code is given express will send 200 by default
      res.send(response.rows);
    } catch (err) {
      next(err);
    }
  });

//returns an array of employee objects
server.get("/api/employee", async (req, res, next) => {
    try {
      const SQL = `SELECT * from employee ORDER BY created_at DESC;`;
      const response = await client.query(SQL);
      //send the response. If no status code is given express will send 200 by default
      res.send(response.rows);
    } catch (err) {
      next(err);
    }
  });

//adds a new employee to the table
server.post("/api/employee", async (req, res, next) => {
    try {
      //destructure the keys needed from the request body
      const { name, department_id } = req.body;
  
      //if no required keys in the request body we will send an error response
      if (!name && !department_id) {
        //send the response with a status code of 400 Bad Request and a message letting the user know what the problem is
        return res.status(400).send({
          message:
            "Please send the name and department_id to create a new employee.",
        });
    }

        //create the SQL query to create a new note based on the information in the request body
        const SQL = `
        INSERT INTO employee(name, department_id)
        VALUES($1, $2)
        RETURNING *
      `;
      //await the response from the client querying the database
      const response = await client.query(SQL, [name, department_id]);
      //send the response with a status code of 201 Created
      res.status(201).send(response.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  //edits a employee based on the id passed and information within the request body
server.put("/api/employee/:id", async (req, res, next) => {
    try {
      const { name, department_id } = req.body;
      const SQL = `UPDATE employee SET name=$1, department_id=$2, updated_at=now() WHERE id=$3 RETURNING *;`
      const response = await client.query(SQL, [name,
          department_id,
          req.params.id,]);
      res.send(response.rows[0]);
    } catch (err) {
      next(err);
    }
  });
  
//deletes a employee based on the id given
server.delete("/api/employee/:id", async (req, res, next) => {
    try {
      //create the SQL query to delete a note by id
      const SQL = `
        DELETE from employee
        WHERE id = $1;
      `;
      //await the response from the client querying the database
      await client.query(SQL, [req.params.id]);
      //send the response with a status code of 204 No Content
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });
  
  //error handling route which returns an object with an error property
  server.use((err, req, res) => {
    res.status(err.status || 500).send({ error: err });
  });