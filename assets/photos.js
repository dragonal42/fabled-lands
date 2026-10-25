'use strict';
function ensurePhotoContext(owner,adventure){if(profile?.id!==owner||state?.adventure.id!==adventure)throw Error('Le carnet ouvert a changé. Revenez à votre aventure pour ajouter ces photos.');}
async function storeAdventurePhoto(image,owner=profile.id){
 const result=await api({action:'upload-photo',id:owner,image});return result.image;
}
async function adventurePhotoData(image){
 if(image.startsWith('data:'))return image;
 const response=await fetch(image);if(!response.ok)throw Error('Une photo est indisponible. Reconnectez-vous avant d’exporter le carnet.');
 const blob=await response.blob();if(!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('Photo non reconnue.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Lecture de la photo impossible.'));reader.readAsDataURL(blob);});
}
