import pandas as pd
import geopandas as gpd
import sys
import traceback

print ("starting")


try:
    # Load the shapefile
    shapefile_gdf = gpd.read_file(r"E:\Github\TDM-vizTool-and-Dashboard\scripts\Add-New-Segments-To-GeoJson\New-Segments.shp")

    # Load the existing GeoJSON file
    geojson_gdf = gpd.read_file(r"E:\Github\TDM-vizTool-and-Dashboard\_site\geo-data\segments_v901_TransitCorridors.geojson")

    # Define the CRS as UTM Zone 12N (EPSG:32612)
    shapefile_gdf = shapefile_gdf.set_crs(epsg=32612)

    # Reproject the shapefile to match the GeoJSON's CRS if necessary
    shapefile_gdf = shapefile_gdf.to_crs(geojson_gdf.crs)


    # Identify fields that are in geojson_gdf but not in shapefile_gdf
    geojson_fields = geojson_gdf.columns
    shapefile_fields = shapefile_gdf.columns
    missing_fields = geojson_fields.difference(shapefile_fields)

    # Add missing fields to shapefile_gdf and set their values to NaN
    for field in missing_fields:
        shapefile_gdf[field] = pd.NA

    # Create a spatial index for the GeoJSON features
    geojson_sindex = geojson_gdf.sindex

    # Function to find the closest feature and fill missing values
    def fill_missing_values(row, geojson_gdf, sindex):
        if row.isna().any():
            # Find the closest geometry in geojson_gdf
            possible_matches_index = list(sindex.nearest(row.geometry.bounds, 1))
            closest_feature = geojson_gdf.iloc[possible_matches_index[0]]
            
            # Fill NA values in the shapefile row with values from the closest GeoJSON feature
            for col in row.index:
                if pd.isna(row[col]):
                    row[col] = closest_feature[col]
                    
        return row

    # Apply the function to each row in shapefile_gdf
    shapefile_gdf = shapefile_gdf.apply(fill_missing_values, axis=1, geojson_gdf=geojson_gdf, sindex=geojson_sindex)



    # Combine the two GeoDataFrames
    combined_gdf = pd.concat([shapefile_gdf.drop(columns=['A','B']), geojson_gdf], ignore_index=True)

    # Save the result to a new GeoJSON file
    combined_gdf.to_file(r"E:\Github\TDM-vizTool-and-Dashboard\_site\geo-data\segments_v901_TransitCorridors_with_New.geojson", driver="GeoJSON")

except Exception as e:
    print("*** There was an error running this script - Check output logfile.")
    
    # Write the error to a file
    with open(r"E:\Github\TDM-vizTool-and-Dashboard\scripts\Add-New-Segments-To-GeoJson\error.txt", "w") as logFile:
        tb = sys.exc_info()[2]
        tbinfo = traceback.format_tb(tb)
        pymsg = "\nPYTHON ERRORS:\nTraceback info:\n" + "".join(tbinfo) + "\nError Info:\n" + str(e)
        logFile.write(pymsg)

    sys.exit(1)


print ("done")