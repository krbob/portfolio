# Stock ecosystem design tokens

This directory vendors the framework-neutral design-token contract from
`stock-analyst-ui@708bb071ad693173585b05644ac553f102aeec50` (contract `1.0.1`).
`source.json` pins the source revision and SHA-256 of both upstream files.

Application code may consume only the manifest's public `semantic` and `component` layers. Primitive
`--ui-ref-*` tokens are private implementation details and are rejected outside the vendored `tokens.css`.
Portfolio maps the public contract to its Tailwind vocabulary in `../../portfolio-tokens.css`; it does not
vendor a component library.

To update the contract, copy both files from one reviewed upstream commit, update `source.json`, and run:

```bash
npm run validate:tokens
```
