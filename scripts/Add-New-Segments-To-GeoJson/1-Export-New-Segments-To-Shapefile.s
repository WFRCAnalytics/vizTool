

;update link/node field order & data and save as Link and Node shapefiles ----------------------
RUN PGM=NETWORK  MSG='Update fields and export Link and Node shapefiles'
FILEI NETI[1]  = 'E:\Github\WF-TDM-v9x\1_Inputs\3_Highway\WFv902_MasterNet.net'    

;note: put fields in order you'd wish them to appear in Master Network,
;      text fields identified with () and integer of field width
FILEO LINKO = 'intermediate\New-Segments.shp',
    FORMAT=SHP,
    INCLUDE=A, B, SEGID

PHASE=LINKMERGE
     
    if (SubStr(SEGID,1,4)<>'NEW_') DELETE
    if (A>B) DELETE

ENDPHASE
    
    
ENDRUN



**"E:\Github\WF-TDM-v9x\2_ModelScripts\_Python\py-tdm-env\python.exe" "2-Add-New-Segments-To-GeoJson-and-Generate-TDM-Segments.py" 1>&2
