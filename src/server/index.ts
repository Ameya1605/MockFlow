import http from 'http';
import express, { Request, Response } from 'express';
import pluralize from 'pluralize';
import { buildMockPrompt } from '../ai/promptBuilder';
import { generateMockResponse } from '../ai/orchestrator';
import { extractSchema, findExportedInterfaces } from '../ast/parser';
import { createChaosMiddleware } from './chaosMiddleware';
import { mockStore } from './store';

let chaosConfig = { latencyMs: 0, errorRate: 0 };


export function setChaosConfig(latencyMs: number, errorRate: number): void {
  chaosConfig = { latencyMs, errorRate };
}

function getResourceName(req: Request): string {
  return new URL(req.originalUrl, 'http://localhost').pathname;
}

function guessInterfaceName(resourceName: string): string {
  const segments = resourceName.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? 'Resource';
  const singular = pluralize.singular(lastSegment);
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

function parseRoute(url: string): { resource: string; id?: string } {
  const pathname = new URL(url, 'http://localhost').pathname;
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    return { resource: pathname };
  }

  if (segments.length === 2) {
    return { resource: pathname };
  }

  const lastSegment = segments[segments.length - 1];
  return {
    resource: `/${segments.slice(0, -1).join('/')}`,
    id: lastSegment,
  };
}

export function startServer(port: number, workspaceRoot: string, apiKey: string): http.Server {
  const app = express();

  app.use(express.json());
  app.use(createChaosMiddleware(() => chaosConfig));

  app.all('*', async (req: Request, res: Response) => {
    console.log(req.method, req.originalUrl);

    const resourceName = getResourceName(req);
    const routeInfo = parseRoute(req.originalUrl);

    if (req.method === 'GET') {
      if (mockStore.hasResource(resourceName)) {
        res.json(mockStore.getAll(resourceName));
        return;
      }

      const interfaces = findExportedInterfaces(workspaceRoot);
      const interfaceName = guessInterfaceName(resourceName);
      const interfaceDecl = interfaces.get(interfaceName);

      if (!interfaceDecl) {
        res.status(404).json({ error: `No interface found for ${interfaceName}` });
        return;
      }

      const schema = extractSchema(interfaceDecl);
      const prompt = buildMockPrompt(resourceName, 'GET', schema);

      try {
        const result = await generateMockResponse(prompt, apiKey);
        mockStore.seed(resourceName, Array.isArray(result) ? result : [result]);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: `Failed to generate mock response: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      return;
    }

    if (req.method === 'POST') {
      const interfaces = findExportedInterfaces(workspaceRoot);
      const interfaceName = guessInterfaceName(routeInfo.resource);
      const interfaceDecl = interfaces.get(interfaceName);

      if (!interfaceDecl) {
        res.status(404).json({ error: `No interface found for ${interfaceName}` });
        return;
      }

      const schema = extractSchema(interfaceDecl);
      const prompt = buildMockPrompt(routeInfo.resource, 'POST', schema, req.body);

      try {
        const aiResult = await generateMockResponse(prompt, apiKey);
        const mergedRecord = { ...(aiResult ?? {}), ...(req.body ?? {}) };
        const createdRecord = mockStore.create(routeInfo.resource, mergedRecord);
        res.status(201).json(createdRecord);
      } catch (error) {
        res.status(500).json({
          error: `Failed to create mock response: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      return;
    }

    if (req.method === 'PUT' && routeInfo.id) {
      const existingRecord = mockStore.getById(routeInfo.resource, routeInfo.id);
      if (!existingRecord) {
        res.status(404).json({ error: 'Record not found' });
        return;
      }

      const updatedRecord = mockStore.update(routeInfo.resource, routeInfo.id, req.body);
      if (!updatedRecord) {
        res.status(404).json({ error: 'Record not found' });
        return;
      }

      res.status(200).json(updatedRecord);
      return;
    }

    if (req.method === 'DELETE' && routeInfo.id) {
      const removed = mockStore.remove(routeInfo.resource, routeInfo.id);
      if (!removed) {
        res.status(404).json({ error: 'Record not found' });
        return;
      }

      res.status(204).send();
      return;
    }

    res.status(501).json({ error: 'Not Implemented' });
  });

  return app.listen(port);
}

export function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
