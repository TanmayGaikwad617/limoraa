import { authRoutes } from "./auth.js";
import { videoRoutes } from "./videos.js";
import { searchRoutes } from "./search.js";
import { collectionRoutes } from "./collections.js";
import { tagRoutes } from "./tags.js";
import { billingRoutes } from "./billing.js";
import { exportRoutes } from "./export.js";
import { healthRoutes } from "./health.js";
export const routes = async (app) => {
    await app.register(authRoutes);
    await app.register(videoRoutes);
    await app.register(searchRoutes);
    await app.register(collectionRoutes);
    await app.register(tagRoutes);
    await app.register(billingRoutes);
    await app.register(exportRoutes);
    await app.register(healthRoutes);
};
