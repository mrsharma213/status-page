import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: ["src/fonts/**", "public/**", "coverage/**"],
  },
];

export default config;
