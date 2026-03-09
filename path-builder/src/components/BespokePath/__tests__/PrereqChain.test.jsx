/**
 * PrereqChain.test.jsx — Unit tests for the PrereqChain component
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrereqChain from "../PrereqChain";

const makeChain = (overrides = {}) => ({
  nodes: [
    { id: 0, title: "Intro to Materials", category: "foundation" },
    { id: 1, title: "Shader Basics", category: "core" },
    { id: 2, title: "Practice Shaders", category: "practice" },
  ],
  edges: [
    { from: 0, to: 1, strength: "strong", overlap: 0.55 },
    { from: 1, to: 2, strength: "weak", overlap: 0.2 },
  ],
  floatingSteps: [],
  missingLinks: [],
  ...overrides,
});

describe("PrereqChain", () => {
  it("renders empty state when no chain provided", () => {
    render(<PrereqChain chain={null} />);
    expect(screen.getByText(/no dependency data/i)).toBeTruthy();
  });

  it("renders empty state when nodes are empty", () => {
    render(<PrereqChain chain={{ nodes: [], edges: [], floatingSteps: [], missingLinks: [] }} />);
    expect(screen.getByText(/no dependency data/i)).toBeTruthy();
  });

  it("renders SVG with correct node count", () => {
    const chain = makeChain();
    const { container } = render(<PrereqChain chain={chain} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    // Should have 3 text nodes for step numbers (1, 2, 3)
    const nodeGroups = container.querySelectorAll("[id^='chain-node-']");
    expect(nodeGroups.length).toBe(3);
  });

  it("displays step count in stats", () => {
    const chain = makeChain();
    render(<PrereqChain chain={chain} />);
    expect(screen.getByText("3 steps")).toBeTruthy();
  });

  it("displays connection count in stats", () => {
    const chain = makeChain();
    render(<PrereqChain chain={chain} />);
    expect(screen.getByText("2 connections")).toBeTruthy();
  });

  it("shows floating step warnings", () => {
    const chain = makeChain({ floatingSteps: [2] });
    render(<PrereqChain chain={chain} />);
    expect(screen.getByText(/Practice Shaders.*has no prerequisite/i)).toBeTruthy();
    expect(screen.getByText(/1 floating/)).toBeTruthy();
  });

  it("shows missing link warnings", () => {
    const chain = makeChain({
      missingLinks: [
        {
          from: 0,
          to: 1,
          suggestedBridge: 'Bridge between "Intro" and "Shader Basics"',
        },
      ],
    });
    render(<PrereqChain chain={chain} />);
    expect(screen.getByText(/Bridge between.*Intro.*Shader Basics/i)).toBeTruthy();
  });

  it("renders legend items", () => {
    render(<PrereqChain chain={makeChain()} />);
    expect(screen.getByText("Foundation")).toBeTruthy();
    expect(screen.getByText("Core")).toBeTruthy();
    expect(screen.getByText("Practice")).toBeTruthy();
    expect(screen.getByText("Missing link")).toBeTruthy();
  });

  it("has the proper container id", () => {
    const { container } = render(<PrereqChain chain={makeChain()} />);
    expect(container.querySelector("#prereq-chain-view")).toBeTruthy();
  });

  it("renders SVG edges matching edge count", () => {
    const chain = makeChain();
    const { container } = render(<PrereqChain chain={chain} />);
    // Each edge is a <path> element inside the SVG
    const svg = container.querySelector("svg");
    const paths = svg.querySelectorAll("path");
    // 2 edges + 0 missing links = at least 2 paths
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it("renders title heading", () => {
    render(<PrereqChain chain={makeChain()} />);
    expect(screen.getByText("Prerequisite Chain")).toBeTruthy();
  });
});
