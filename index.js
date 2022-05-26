const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jsonwebtoken = require('jsonwebtoken');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ps0au.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()
    });
}


async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('picasso_painting').collection('tools');
        const mypurchaseCollection = client.db('picasso_painting').collection('mypurchase');
        const userCollection = client.db('picasso_painting').collection('users');

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.put('/user/:admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requestor = req.decoded.email
            const requestorAccount = await userCollection.findOne({ email: requestor });
            if (requestorAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden Access' })
            }

        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, option);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })

        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tools = await toolsCollection.findOne(query);
            res.send(tools)
        })

        // Quantity update
        app.patch('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const newQuantity = req.body;
            console.log(newQuantity)
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    minimumOrderQuantity: newQuantity.minimumOrderQuantity
                }
            };
            const result = await toolsCollection.updateOne(filter, updatedDoc, options);

            res.send(result);

        })

        app.post('/mypurchase', async (req, res) => {
            const mypurchase = req.body;
            const result = await mypurchaseCollection.insertOne(mypurchase);
            res.send(result);
        })

        app.get('/mypurchase', verifyJWT, async (req, res) => {
            const customer = req.query.customer;

            const decodedEmail = req.decoded.email;
            if (customer === decodedEmail) {
                const query = { customer: customer };
                const mypurchases = await mypurchaseCollection.find(query).toArray();
                res.send(mypurchases);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        })
    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from Picasso!')
})

app.listen(port, () => {
    console.log(`Picasso app listening on port ${port}`)
})