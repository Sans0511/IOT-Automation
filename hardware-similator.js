async function main() {
  await import("dotenv/config");
  const { default: mqtt } = await import("mqtt");

  const brokerUrl =
    process.env.MQTT_BROKER_URL ?? "mqtt://broker.hivemq.com:1883";
  const farmId = process.env.FARM_ID ?? "6afc823555b4ff51a7320c25";
  const sensorId = process.env.DEVICE_ID ?? "6afd34bc265f045f0f08ec79";
  const pumpId = process.env.PUMP_DEVICE_ID ?? "6afcd5ff265f045f0f08ec73";
  const valve1Id = process.env.VALVE_1_DEVICE_ID ?? "6afcd5ff265f045f0f08ec74";
  const valve2Id = process.env.VALVE_2_DEVICE_ID ?? "6afd0ddf265f045f0f08ec77";
  const intervalMs = Number(process.env.INTERVAL_MS ?? "1000");
  const telemetryTopic = `farm/${farmId}/device/${sensorId}/telemetry`;
  const statusTopic = (deviceId) =>
    `farm/${farmId}/device/${deviceId}/status`;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("INTERVAL_MS must be a positive number");
  }

  let stopped = false;
  let moistureTimer = null;
  const delayTimers = new Set();

  console.log(`connecting to ${brokerUrl}`);

  const client = mqtt.connect(brokerUrl, {
    connectTimeout: 30_000,
    reconnectPeriod: 2_000,
    clean: true,
  });

  const stop = () => {
    stopped = true;
    if (moistureTimer) {
      clearInterval(moistureTimer);
    }
    for (const delayTimer of delayTimers) {
      clearTimeout(delayTimer);
    }
    client.end(true);
    console.log("sensor simulator stopped");
    process.exit(0);
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await new Promise((resolve, reject) => {
    const onConnect = () => {
      client.off("error", onError);
      console.log("sensor connected");
      resolve();
    };
    const onError = (error) => {
      client.off("connect", onConnect);
      reject(error);
    };

    client.once("connect", onConnect);
    client.once("error", onError);
  });

  client.on("reconnect", () => {
    console.log("sensor reconnecting...");
  });

  function publish(topic, payload, label) {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        console.error(`${label} publish failed: ${error.message}`);
      }
    });
    console.log(`${new Date().toISOString()} ${label} SENT -> ${topic}`);
  }

  function sendMoisture(value) {
    return publish(telemetryTopic, { moisture: value }, `moisture ${value}%`);
  }

  function sendStatus(deviceId, payload, label) {
    return publish(statusTopic(deviceId), payload, label);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        delayTimers.delete(timer);
        resolve();
      }, ms);
      delayTimers.add(timer);
    });
  }

  async function runCycle() {
    sendStatus(valve1Id, { state: "ONLINE", valveOpen: true }, "valve 1 ON");
    await delay(1_000);
    sendStatus(pumpId, { state: "ONLINE", pumpOn: true }, "pump ON");
    await delay(10_000);
    sendStatus(valve2Id, { state: "ONLINE", valveOpen: true }, "valve 2 ON");
    await delay(10_000);
    sendStatus(valve1Id, { state: "ONLINE", valveOpen: false }, "valve 1 OFF");
    await delay(10_000);
    sendStatus(pumpId, { state: "ONLINE", pumpOn: false }, "pump OFF");
    await delay(2_000);
    sendStatus(valve2Id, { state: "ONLINE", valveOpen: false }, "valve 2 OFF");
  }

  async function runCycles() {
    while (!stopped) {
      await runCycle();
    }
  }

  let moisture = 50;
  sendMoisture(moisture);

  moistureTimer = setInterval(() => {
    moisture = Math.min(
      100,
      Math.max(0, moisture + (Math.random() < 0.5 ? -1 : 1)),
    );
    sendMoisture(moisture);
  }, intervalMs);

  void runCycles().catch(console.error);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
