const axios = require("axios");
const fs = require("fs");
const root_url = "https://cnext.loggly.com/apiv2/";
const AWS = require("aws-sdk");
const { ToadScheduler, SimpleIntervalJob, Task } = require("toad-scheduler");

const start = async () => {
    const scheduler = new ToadScheduler();
    counter = 0;
    const task = new Task("upload logs task", () => {
        getAndUpload();
    });
    const job = new SimpleIntervalJob({ days: 14 }, task);
    scheduler.addSimpleIntervalJob(job);

    process.on("SIGINT", function () {
        job.stop();
    });
};

const getAndUpload = async () => {
    await getAllEvents();
    pushToS3();
};

const getAllEvents = async () => {
    console.log("Trying to fetch events from Loggly Cnext");
    token = "d22d46ad-8dfb-4976-ad13-5d8d6f7cf979";
    url = root_url + "search?q=*&from=-2h&until=now";
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    const result = await axios.get(url, config);
    const rsid = result.data.rsid.id;
    event_url = root_url + "events?rsid=" + rsid + "&format=csv";

    const events = await axios.get(event_url, { ...config, responseType: "stream" });
    events.data.pipe(fs.createWriteStream("./temp/events.csv"));
};

const pushToS3 = async () => {
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    fs.readFile("./temp/events.csv", (err, data) => {
        if (err) throw err;
        const fileName = new Date().toISOString() + ".csv";
        const params = {
            Bucket: "cnext-logs",
            Key: fileName,
            Body: JSON.stringify(data, null, 2),
        };
        s3.upload(params, function (s3Err, data) {
            if (s3Err) throw s3Err;
            console.log(`File uploaded successfully at ${data.Location}`);
        });
    });
};

start();
