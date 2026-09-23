import test from "node:test";
import assert from "node:assert/strict";
import handler, {
  infosysDescription,
  isPrivateAddress,
} from "../api/job-details.mjs";

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(url) {
  const res = responseRecorder();
  await handler({ method: "POST", body: { url } }, res);
  return res;
}

test("Infosys job URLs use the structured provider response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /intapgateway\.infosysapps\.com/);
    return new Response(
      JSON.stringify({
        postingTitle: "Front End Engineer",
        organizationName: "Infosys",
        city: "Bangalore",
        country: "India",
        postingDesc:
          "Build accessible web experiences for enterprise customers.",
        rolesResponsibilities:
          "Develop React components and collaborate with product teams.",
        techRequirement: "React, JavaScript, HTML, CSS, and REST APIs.",
        preferredSkills: "Redux Toolkit",
      }),
      { status: 200 },
    );
  };
  try {
    const res = await invoke(
      "https://career.infosys.com/jobdesc?jobReferenceCode=PROGEN-HROREC-213046",
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.job.title, "Front End Engineer");
    assert.equal(res.body.job.company, "Infosys");
    assert.equal(res.body.job.location, "Bangalore, India");
    assert.match(res.body.job.description, /Redux Toolkit/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generic career pages extract readable content for different employers", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [
    "https://jobs.lever.co/example/frontend-engineer",
    "https://boards.greenhouse.io/example/jobs/12345",
    "https://www.linkedin.com/jobs/software-engineer",
  ];
  globalThis.fetch = async (url) =>
    new Response(
      `<html><head><title>Software Engineer | ${new URL(url).hostname}</title></head><body><main>${"Develop accessible React applications with JavaScript, REST APIs, automated tests, and cross-functional engineering partners. ".repeat(4)}</main></body></html>`,
      { status: 200 },
    );
  try {
    for (const url of urls) {
      const res = await invoke(url);
      assert.equal(res.statusCode, 200, url);
      assert.equal(
        res.body.job.title,
        `Software Engineer | ${new URL(url).hostname}`,
      );
      assert.ok(res.body.job.description.length >= 250, url);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Infosys description omits missing fields and labels supplementary data", () => {
  assert.equal(
    infosysDescription({
      postingDesc: "Build user interfaces.",
      preferredSkills: "React",
      educationalRequirement: "Bachelor's degree",
    }),
    "Build user interfaces.\n\nPreferred skills: React\n\nEducation: Bachelor's degree",
  );
});

test("job extraction blocks private and cloud-metadata IP destinations before fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("A private destination must not be fetched");
  };
  try {
    for (const url of [
      "http://127.0.0.1/admin",
      "http://10.0.0.1",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
    ]) {
      const res = await invoke(url);
      assert.equal(res.statusCode, 400, url);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("private-address detection covers local IPv4 and IPv6 ranges", () => {
  for (const address of [
    "0.0.0.0",
    "127.0.0.1",
    "10.2.3.4",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fe80::1",
    "fd00::1",
  ])
    assert.equal(isPrivateAddress(address), true, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
    assert.equal(isPrivateAddress(address), false, address);
});
