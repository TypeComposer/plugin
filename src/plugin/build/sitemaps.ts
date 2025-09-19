import { Node, SyntaxKind, SourceFile, ObjectLiteralExpression } from "ts-morph";
import { ProjectBuild } from "../transpilator/ProjectBuild";
import path from "node:path";
import { writeFileSync } from "node:fs";



export namespace SiteMaps {

	interface RouteItem {
		path: string;
		component?: string;
		redirect?: string;
		guard?: string;
		children?: RouteItem[];
	}

	interface RouteObject { routes: RouteItem[]; history?: "hash" | "history"; sitemaps?: { baseUrl: string }, robots?: { [key: string]: any } | "auto" }

	interface SitemapEntry {
		loc: string;
		lastmod: string;
		changefreq: string;
		priority: string;
	}


	async function parseRouterConfig(sourceFile: SourceFile): Promise<RouteObject> {
		const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

		let routesResult: RouteObject = {
			routes: []
		};

		for (const callExpr of callExpressions) {
			const expression = callExpr.getExpression();

			if (Node.isPropertyAccessExpression(expression)) {
				const propName = expression.getName();
				const routerName = expression.getExpression().getText();

				if (routerName === "Router" && propName === "create") {
					const args = callExpr.getArguments();
					if (args.length === 1 && Node.isObjectLiteralExpression(args[0])) {
						const objLiteral = args[0];
						const stitemaps = objLiteral.getProperty("sitemaps");
						if (stitemaps && Node.isPropertyAssignment(stitemaps)) {
							const init = stitemaps.getInitializer();
							if (init && Node.isObjectLiteralExpression(init)) {
								routesResult.sitemaps = parseObject(init) as any;
							}
						}
						const robots = objLiteral.getProperty("robots");
						if (robots && Node.isPropertyAssignment(robots)) {
							const init = robots.getInitializer();
							if (init && Node.isStringLiteral(init)) {
								routesResult.robots = init.getLiteralValue() as "auto";
							} else if (init && Node.isObjectLiteralExpression(init)) {
								routesResult.robots = parseObject(init);
							}
						}
						const history = objLiteral.getProperty("history");
						if (history && Node.isPropertyAssignment(history)) {
							const init = history.getInitializer();
							if (init && Node.isStringLiteral(init)) {
								routesResult.history = init.getLiteralValue() as "hash" | "history";
							}
						}
						const routesProp = objLiteral.getProperty("routes");
						if (routesProp && Node.isPropertyAssignment(routesProp)) {
							const initializer = routesProp.getInitializer();
							if (initializer && Node.isArrayLiteralExpression(initializer)) {
								routesResult.routes = parseRoutesArray(initializer);
							}
						}
					}
				}
			}
		}

		return routesResult;
	}


	function parseObject(objLiteral: ObjectLiteralExpression): any {
		const result: Record<string, any> = {};

		objLiteral.getProperties().forEach((prop) => {
			if (Node.isPropertyAssignment(prop)) {
				const key = prop.getName();
				const initializer = prop.getInitializer();

				if (!initializer) return;

				if (Node.isStringLiteral(initializer)) {
					result[key] = initializer.getLiteralValue();
				}
				else if (Node.isNumericLiteral(initializer)) {
					result[key] = Number(initializer.getLiteralValue());
				}
				else if (Node.isObjectLiteralExpression(initializer)) {
					result[key] = parseObject(initializer);
				}
				else if (Node.isArrayLiteralExpression(initializer)) {
					result[key] = initializer.getElements().map((el) => {
						if (Node.isStringLiteral(el)) {
							return el.getLiteralValue();
						} else if (Node.isNumericLiteral(el)) {
							return Number(el.getLiteralValue());
						} else if (Node.isObjectLiteralExpression(el)) {
							return parseObject(el);
						} else {
							return el.getText();
						}
					});
				}
				else {
					result[key] = initializer.getText();
				}
			}
		});

		return result;
	}

	function parseRoutesArray(arrayLiteral: import("ts-morph").ArrayLiteralExpression): RouteItem[] {
		const items = arrayLiteral.getElements();
		const routes: { [key: string]: any }[] = [];

		for (const item of items) {
			if (Node.isObjectLiteralExpression(item)) {
				const routeObj: { [key: string]: any } = {};
				for (const prop of item.getProperties()) {
					if (Node.isPropertyAssignment(prop)) {
						const name = prop.getName();
						const init = prop.getInitializer();

						if (init && Node.isStringLiteral(init)) {
							routeObj[name] = init.getLiteralValue();
						}
						else if (init && Node.isArrayLiteralExpression(init))
							routeObj[name] = parseRoutesArray(init);
						else {
							routeObj[name] = init?.getText();
						}
					}
				}

				routes.push(routeObj);
			}
		}
		return routes as RouteItem[];
	}



	function generateSitemapXML(
		routerJson: RouteObject,
		baseUrl: string = "https://www.example.com"
	): string {
		function processRoutes(
			routes: RouteItem[],
			parentPath: string = ""
		): SitemapEntry[] {
			let entries: SitemapEntry[] = [];
			routes.forEach((route) => {
				if (route.redirect) return;

				const routePath = route.path.startsWith("/")
					? route.path
					: "/" + route.path;
				const combinedPath = parentPath
					? (parentPath.endsWith("/") ? parentPath.slice(0, -1) : parentPath) +
					routePath
					: routePath;

				const today = new Date().toISOString().split("T")[0];
				entries.push({
					loc: baseUrl + combinedPath,
					lastmod: today,
					changefreq: "daily",
					priority: "0.5",
				});
				if (route.children && route.children.length > 0) {
					entries = entries.concat(processRoutes(route.children, combinedPath));
				}
			});
			return entries;
		}

		const routes = routerJson.routes;
		const sitemapEntries = processRoutes(routes, "");

		let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
		xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
		sitemapEntries.forEach((entry) => {
			xml += `  <url>\n`;
			xml += `    <loc>${entry.loc}</loc>\n`;
			xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
			xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
			xml += `    <priority>${entry.priority}</priority>\n`;
			xml += `  </url>\n`;
		});
		xml += `</urlset>`;
		return xml;
	}

	function baseRobotTxt(baseUrl: string) {
		const base = {
			"robots": [
				{
					"userAgent": "*",
					"allow": ["/"],
					"disallow": [],
					"crawlDelay": 10
				},
				{
					"userAgent": "Googlebot",
					"allow": ["/public/"],
					"disallow": ["/private/"]
				}
			],
			"sitemap": baseUrl + "/sitemap.xml"
		}
		return JSON.stringify(base, null, 2);
	}

	export async function build(project: ProjectBuild) {
		const routerPath = project.routerPath;
		const sourceFile = project.getSourceFiles().find(e => e.getFilePath() === routerPath);
		if (sourceFile) {
			const routes = await parseRouterConfig(sourceFile);
			if (routes?.sitemaps && routes.sitemaps.baseUrl) {
				if (routes.sitemaps.baseUrl.endsWith("/")) {
					routes.sitemaps.baseUrl = routes.sitemaps.baseUrl.slice(0, -1);
				}
				const sitemapXML = generateSitemapXML(routes, `${routes.sitemaps.baseUrl}${routes.history === "hash" ? "/#" : ""}`);
				writeFileSync(path.resolve(project.outputDir, "sitemap.xml"), sitemapXML, {
					encoding: "utf-8",
				});

			}
			let robotsTxt = ""
			if (routes.robots && routes.robots !== "auto")
				robotsTxt = JSON.stringify(routes.robots);
			else if (routes.robots == "auto" && routes.sitemaps && routes.sitemaps.baseUrl)
				robotsTxt = baseRobotTxt(routes.sitemaps.baseUrl);
			if (robotsTxt)
				writeFileSync(path.resolve(project.outputDir, "robots.txt"), robotsTxt, {
					encoding: "utf-8",
				});
		}
	}

}