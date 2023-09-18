library(tidyverse)
library(sf)
library(jsonlite)

# create segid label location json
segshp <- st_read("C:/Users/cday/Documents/arcgis-web-appbuilder-2.20/server/apps/2/widgets/tttScenarioManager/data/segmentshapefile/wfsegs20211117.shp")
segcent <- segshp %>%
  st_point_on_surface() %>%
  mutate(X_UTM = unlist(map(geometry,1)),
         Y_UTM = unlist(map(geometry,2))) %>%
  st_transform(crs = 4326) %>%
  mutate(Lon = unlist(map(geometry,1)),
         Lat = unlist(map(geometry,2))) %>%
  as_tibble() %>%
  select(SEGID,Lat,Lon,X_UTM,Y_UTM) %>%
  toJSON(pretty = TRUE)

write(segcent, "C:/Users/cday/Documents/arcgis-web-appbuilder-2.20/server/apps/2/widgets/tttScenarioManager/data/labellocation/seg_label_locations.json")


# create linkid label location json
masterlink <- st_read("C:/Users/cday/Documents/arcgis-web-appbuilder-2.20/server/apps/2/widgets/tttScenarioManager/data/labellocation/MasterNet - 2023-03-01 - Link.shp") %>%
  select(LINKID,geometry)
linkcent <- masterlink %>%
  st_centroid() %>%
  mutate(X_UTM = unlist(map(geometry,1)),
         Y_UTM = unlist(map(geometry,2))) %>%
  st_set_crs(26912) %>%
  st_transform(crs = 4326) %>%
  mutate(Lon = unlist(map(geometry,1)),
         Lat = unlist(map(geometry,2))) %>%
  as_tibble() %>%
  rename("lid" = LINKID) %>%
  select(lid,Lat,Lon,X_UTM,Y_UTM) %>%
  toJSON(pretty = TRUE)

write(linkcent, "C:/Users/cday/Documents/arcgis-web-appbuilder-2.20/server/apps/2/widgets/tttScenarioManager/data/labellocation/link_label_locations.json")

# create nodeid label location json
masternode <- st_read("C:/Users/cday/Documents/arcgis-web-appbuilder-2.20/server/apps/2/widgets/tttScenarioManager/data/labellocation/MasterNet - 2023-03-01 - Node.shp") %>%
  select(N_V9,geometry)
nodecent <- masternode %>%
  mutate(X_UTM = unlist(map(geometry,1)),
         Y_UTM = unlist(map(geometry,2))) %>%
  st_set_crs(26912) %>%
  st_transform(crs = 4326) %>%
  mutate(Lon = unlist(map(geometry,1)),
         Lat = unlist(map(geometry,2))) %>%
  as_tibble() %>%
  rename("nid" = N_V9) %>%
  select(nid,Lat,Lon,X_UTM,Y_UTM) %>%
  toJSON(pretty = TRUE)

write(nodecent, "C:/Users/cday/Documents/arcgis-web-appbuilder-2.20/server/apps/2/widgets/tttScenarioManager/data/labellocation/node_label_locations.json")

